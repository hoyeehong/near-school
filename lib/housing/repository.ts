import { database } from "../db";
import { getPlaces } from "../repository";
import {
  housingFilterSchema,
  type HousingResponse,
  type Home,
  type HousingFilters,
} from "./types";
export async function findHomes(
  raw: Partial<HousingFilters>,
): Promise<HousingResponse> {
  const f = housingFilterSchema.parse(raw);
  if (!process.env.DATABASE_URL)
    return { homes: [], total: 0, refreshedAt: null, filters: f, sources: [] };
  const args: unknown[] = [],
    conditions = ["t.units=1"];
  const param = (v: unknown) => {
    args.push(v);
    return "$" + args.length;
  };
  conditions.push(
    `t.month >= (date_trunc('month',(now() AT TIME ZONE 'Asia/Singapore')::date) - (${param(f.months)}::int - 1) * interval '1 month')::date AND t.month <= (now() AT TIME ZONE 'Asia/Singapore')::date`,
  );
  if (f.kind !== "all") conditions.push(`h.kind=${param(f.kind)}`);
  if (f.query)
    conditions.push(
      `strpos(lower(h.name || ' ' || h.address),lower(${param(f.query)}))>0`,
    );
  if (f.propertyType)
    conditions.push(`t.property_type=${param(f.propertyType)}`);
  if (f.maxPrice) conditions.push(`t.price<=${param(f.maxPrice)}`);
  if (f.minArea) conditions.push(`t.area>=${param(f.minArea)}`);
  if (f.saleType !== "all") conditions.push(`t.sale_type=${param(f.saleType)}`);
  if (f.ids) {
    const ids = f.ids.split(",");
    if (ids.length > 3) throw new Error("Compare at most three homes");
    conditions.push(`h.id=ANY(${param(ids)}::text[])`);
  }
  let distance = "NULL::double precision";
  if (f.nearId) {
    const origin = (await getPlaces()).find((p) => p.id === f.nearId);
    if (!origin?.coordinates)
      throw new Error("Choose a school with a map location");
    const point = `ST_SetSRID(ST_MakePoint(${param(origin.coordinates[0])},${param(origin.coordinates[1])}),4326)::geography`;
    distance = `ST_Distance(h.location,${point})`;
    conditions.push(`ST_DWithin(h.location,${point},${param(f.radiusMetres)})`);
  }
  const { rows } = await database().query(
    `SELECT h.id,h.name,h.address,h.kind,h.source_url,h.refreshed_at,ST_X(h.location::geometry) AS lng,ST_Y(h.location::geometry) AS lat,
 ${distance} AS distance, count(*)::int AS n, percentile_cont(0.5) WITHIN GROUP(ORDER BY t.price) AS median,
 percentile_cont(0.25) WITHIN GROUP(ORDER BY t.price) AS lower,percentile_cont(0.75) WITHIN GROUP(ORDER BY t.price) AS upper,
 CASE WHEN count(DISTINCT t.area_type)=1 AND min(t.area_type) <> 'Unknown' THEN percentile_cont(0.5) WITHIN GROUP(ORDER BY t.price/(t.area*10.76391041671)) ELSE NULL END AS psf,
 percentile_cont(0.5) WITHIN GROUP(ORDER BY t.area) AS area,to_char(max(t.month),'YYYY-MM') AS latest,to_char(min(t.month),'YYYY-MM') AS first,
 array_agg(DISTINCT t.property_type) AS types,array_agg(DISTINCT t.tenure) AS tenures,array_agg(DISTINCT t.area_type) AS areas,array_agg(DISTINCT t.sale_type) AS sales,count(*) OVER()::int AS total
 FROM housing_projects h JOIN housing_transactions t ON h.id=t.project_id WHERE ${conditions.join(" AND ")} GROUP BY h.id ORDER BY distance NULLS LAST,median,h.id LIMIT 100`,
    args,
  );
  const refreshed = await database().query(
    "SELECT source,refreshed_at FROM housing_refreshes ORDER BY source",
  );
  const homes: Home[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    address: r.address,
    category: "home",
    quality: "official",
    coordinates: r.lng === null ? null : [r.lng, r.lat],
    sourceUrl: r.source_url,
    updatedAt: new Date(r.refreshed_at).toISOString(),
    housing: {
      filterSummary: `Last ${f.months} months · ${f.saleType} · ${f.propertyType || "all property types"}${f.maxPrice ? ` · price up to S$${f.maxPrice.toLocaleString("en-SG")}` : ""}${f.minArea ? ` · at least ${f.minArea} m²` : ""}`,
      kind: r.kind,
      count: r.n,
      medianPrice: r.median,
      lowerPrice: r.lower,
      upperPrice: r.upper,
      medianPsf: r.psf,
      medianArea: r.area,
      latestMonth: r.latest,
      firstMonth: r.first,
      propertyTypes: r.types,
      tenures: r.tenures,
      areaTypes: r.areas,
      saleTypes: r.sales,
      distanceMetres: r.distance,
    },
  }));
  return {
    homes,
    total: rows[0]?.total ?? 0,
    filters: f,
    refreshedAt: refreshed.rows.length
      ? new Date(
          Math.min(
            ...refreshed.rows.map((r) => new Date(r.refreshed_at).getTime()),
          ),
        ).toISOString()
      : null,
    sources: refreshed.rows.map((r) => r.source),
  };
}
export async function getHomePlace(id: string) {
  const { rows } = await database().query(
    "SELECT id,name,address,kind,source_url,refreshed_at,ST_X(location::geometry) AS lng,ST_Y(location::geometry) AS lat FROM housing_projects WHERE id=$1",
    [id],
  );
  const r = rows[0];
  return r
    ? {
        id: r.id,
        name: r.name,
        address: r.address,
        category: "home" as const,
        quality: "official" as const,
        sourceUrl: r.source_url,
        updatedAt: new Date(r.refreshed_at).toISOString(),
        coordinates:
          r.lng === null ? null : ([r.lng, r.lat] as [number, number]),
      }
    : null;
}
export async function recentTransactions(id: string) {
  return (
    await database().query(
      `SELECT to_char(month,'YYYY-MM') AS month,price::float8,area::float8,property_type AS "propertyType",area_type AS "areaType",tenure,sale_type AS "saleType",floor_range AS "floorRange",units FROM housing_transactions WHERE project_id=$1 ORDER BY month DESC,id LIMIT 20`,
      [id],
    )
  ).rows;
}
