import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { Storage } from "@google-cloud/storage";
import { demoPlaces } from "../data/demo";
import { placeSchema, type Place } from "../lib/types";
const dataset = "d_688b934f82c1059ed0a6993d2a829089";
const canonical = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/primaryschool$/, "primary");
const mapping = new Map(
  demoPlaces
    .filter((p) => p.category === "school")
    .map((p) => [canonical(p.name), p]),
);
mapping.set(
  "singaporechinesegirlsprimary",
  demoPlaces.find((p) => p.id === "scgs")!,
);
const primaryMixed = new Set([
  "CATHOLIC HIGH SCHOOL",
  "CHIJ ST. NICHOLAS GIRLS\' SCHOOL",
  "MARIS STELLA HIGH SCHOOL",
]);
const version = new Date().toISOString().replace(/[:.]/g, "-");
const url = `https://api-open.data.gov.sg/v1/public/api/datasets/${dataset}/poll-download`;
const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
if (!response.ok)
  throw new Error(`MOE dataset unavailable: ${response.status}`);
const metadata = await response.json();
if (!metadata.data?.url)
  throw new Error("Dataset download not ready; retry later");
const csv = await fetch(metadata.data.url, {
  signal: AbortSignal.timeout(30000),
});
if (!csv.ok) throw new Error(`Dataset download failed: ${csv.status}`);
const records = parse(await csv.text(), {
  columns: true,
  skip_empty_lines: true,
}) as Record<string, string>[];
const places: Place[] = [];
for (const row of records.filter(
  (r) =>
    /primary/i.test(r.mainlevel_code ?? "") || primaryMixed.has(r.school_name),
)) {
  const name = row.school_name;
  const match = mapping.get(canonical(name));
  let coordinates: [number, number] | null = null;
  if (process.env.ONEMAP_TOKEN) {
    const res = await fetch(
      `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(row.postal_code)}&returnGeom=Y&getAddrDetails=Y`,
      {
        headers: { Authorization: process.env.ONEMAP_TOKEN },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);
    const found = (await res.json()).results?.find(
      (r: Record<string, string>) => r.POSTAL === row.postal_code,
    );
    if (found) coordinates = [Number(found.LONGITUDE), Number(found.LATITUDE)];
  }
  places.push(
    placeSchema.parse({
      id:
        match?.id ??
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/-$/, ""),
      name,
      category: "school",
      address: row.address,
      postalCode: row.postal_code,
      coordinates,
      ...(match?.twoTrackFrom ? { twoTrackFrom: match.twoTrackFrom } : {}),
      sourceUrl: `https://data.gov.sg/datasets/${dataset}/view`,
      updatedAt: new Date().toISOString().slice(0, 10),
      quality: "official",
    }),
  );
}
// Additional authorised HDB / agency amenity snapshots use the same validated format.
for (const file of process.argv.slice(2)) {
  const additional = JSON.parse(await readFile(file, "utf8"));
  places.push(...placeSchema.array().parse(additional));
}
if (new Set(places.map((p) => p.id)).size !== places.length)
  throw new Error("Duplicate place IDs");
const report = {
  version,
  source: url,
  schools: places.filter((p) => p.category === "school").length,
  places: places.length,
  missingGeometry: places.filter((p) => !p.coordinates).length,
  twoTrack: places.filter((p) => p.twoTrackFrom).length,
  officialDistances: 0,
  releaseReady: false,
  note: "Candidate only. Review coverage, current school sites, permissions and official distance source before publication.",
};
await mkdir("data/candidates", { recursive: true });
await writeFile(
  `data/candidates/${version}.json`,
  JSON.stringify({ version, places, report }, null, 2),
);
if (process.env.SNAPSHOT_BUCKET)
  await new Storage()
    .bucket(process.env.SNAPSHOT_BUCKET)
    .file(`candidates/${version}.json`)
    .save(JSON.stringify({ version, places, report }), {
      contentType: "application/json",
    });
console.log(JSON.stringify(report, null, 2));
