import { demoPlaces, policies } from "@/data/demo";
import { database } from "./db";
import { metresBetween } from "./rules";
import type { Category, OfficialDistance, Place, Policy } from "./types";
export const isLiveData = () => process.env.DATA_MODE === "live";
export async function getPlaces(): Promise<Place[]> {
  if (!isLiveData()) return demoPlaces;
  const { rows } = await database().query(
    "SELECT payload FROM places WHERE published = true ORDER BY id",
  );
  return rows.map((r) => r.payload as Place);
}
export async function findPlaces(
  options: {
    categories?: Category[];
    query?: string;
    twoTrackOnly?: boolean;
    year?: number;
    nearId?: string;
    radiusMetres?: number;
  },
  places?: Place[],
) {
  const all = places ?? (await getPlaces());
  const origin = all.find((p) => p.id === options.nearId);
  if (options.nearId && !origin?.coordinates) return [];
  const radius = options.radiusMetres ?? 1000;
  const textMatches = (p: Place) =>
    (!options.categories?.length || options.categories.includes(p.category)) &&
    (!options.twoTrackOnly ||
      (p.twoTrackFrom !== undefined &&
        p.twoTrackFrom <= (options.year ?? 2027))) &&
    (!options.query ||
      `${p.name} ${p.address} ${p.postalCode ?? ""}`
        .toLowerCase()
        .includes(options.query.toLowerCase()));
  if (isLiveData() && origin?.coordinates) {
    const { rows } = await database().query(
      "SELECT payload FROM places WHERE published=true AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography,$3) ORDER BY ST_Distance(location, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography)",
      [...origin.coordinates, radius],
    );
    return rows.map((r) => r.payload as Place).filter(textMatches);
  }
  return all
    .filter(textMatches)
    .filter(
      (p) =>
        !origin?.coordinates ||
        (p.coordinates &&
          metresBetween(origin.coordinates, p.coordinates) <= radius),
    );
}
export async function getDistance(
  addressId: string,
  schoolId: string,
  year: number,
): Promise<OfficialDistance | null> {
  if (!isLiveData()) return null;
  const { rows } = await database().query(
    "SELECT payload FROM official_distances WHERE address_id=$1 AND school_id=$2 AND exercise_year=$3 AND authorised=true",
    [addressId, schoolId, year],
  );
  return rows[0]?.payload ?? null;
}
export async function searchPolicies(
  query: string,
  year: number,
): Promise<Policy[]> {
  if (
    isLiveData() ||
    (process.env.AI_MODE === "live" && process.env.DATABASE_URL)
  ) {
    if (
      process.env.VERTEX_EMBEDDING_MODEL &&
      process.env.GOOGLE_CLOUD_PROJECT
    ) {
      try {
        const { embed } = await import("./ai");
        const vector = await embed(query);
        const { rows } = await database().query(
          `WITH eligible AS (
          SELECT *, row_number() OVER (ORDER BY ts_rank(search,plainto_tsquery('english',$1)) DESC,id) AS keyword_rank,
          row_number() OVER (ORDER BY embedding <=> $3::vector,id) AS vector_rank
          FROM policies WHERE from_year <= $2 AND (to_year IS NULL OR to_year >= $2)
          AND embedding IS NOT NULL AND embedding_model=$4
        ) SELECT payload FROM eligible ORDER BY (1.0/(60+keyword_rank)+1.0/(60+vector_rank)) DESC LIMIT 4`,
          [
            query,
            year,
            JSON.stringify(vector),
            process.env.VERTEX_EMBEDDING_MODEL,
          ],
        );
        if (rows.length) return rows.map((r) => r.payload);
      } catch {
        console.warn(JSON.stringify({ event: "retrieval_keyword_fallback" }));
      }
    }
    const { rows } = await database().query(
      "SELECT payload FROM policies WHERE from_year <= $2 AND (to_year IS NULL OR to_year >= $2) ORDER BY ts_rank(search, plainto_tsquery('english',$1)) DESC LIMIT 4",
      [query, year],
    );
    return rows.map((r) => r.payload);
  }
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);
  return policies
    .filter((p) => p.fromYear <= year && (!p.toYear || p.toYear >= year))
    .sort(
      (a, b) =>
        terms.filter((t) => b.text.toLowerCase().includes(t)).length -
        terms.filter((t) => a.text.toLowerCase().includes(t)).length,
    )
    .slice(0, 4);
}
