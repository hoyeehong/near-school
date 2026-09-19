import { readFile } from "node:fs/promises";
import { z } from "zod";
import { database } from "../lib/db";
import { placeSchema } from "../lib/types";
const input = z.object({
  version: z.string(),
  places: placeSchema.array(),
  report: z.record(z.string(), z.unknown()),
  officialDistances: z.array(
    z.object({
      addressId: z.string(),
      schoolId: z.string(),
      year: z.number().int(),
      band: z.enum(["within-1km", "between-1-and-2km", "beyond-2km"]),
      sourceUrl: z.url(),
      verifiedAt: z.string(),
    }),
  ),
});
if (!process.argv[2])
  throw new Error("Usage: npm run data:publish -- reviewed-snapshot.json");
const snapshot = input.parse(
  JSON.parse(await readFile(process.argv[2], "utf8")),
);
if (
  process.env.OFFICIAL_DISTANCE_REUSE_APPROVED !== "true" ||
  !process.env.OFFICIAL_DISTANCE_SOURCE_URL
)
  throw new Error("Official data reuse approval and source URL are required");
if (
  !snapshot.officialDistances.some((d) => d.year === 2027) ||
  snapshot.places.filter((p) => p.twoTrackFrom === 2027).length !== 12 ||
  snapshot.places.some((p) => p.quality !== "official" || !p.coordinates)
)
  throw new Error(
    "Release gate failed: require 2027 official records, all 12 schools, and official mapped places",
  );
const ids = new Set(snapshot.places.map((p) => p.id));
if (
  ids.size !== snapshot.places.length ||
  snapshot.officialDistances.some((d) => !ids.has(d.schoolId))
)
  throw new Error("Invalid snapshot references");
const pool = database(),
  client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(240920)");
  await client.query("UPDATE places SET published=false");
  for (const p of snapshot.places)
    await client.query(
      "INSERT INTO places(id,payload,location,published,snapshot_version) VALUES($1,$2,ST_SetSRID(ST_MakePoint($3,$4),4326)::geography,true,$5) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,location=excluded.location,published=true,snapshot_version=excluded.snapshot_version",
      [p.id, p, ...p.coordinates!, snapshot.version],
    );
  await client.query("UPDATE official_distances SET authorised=false");
  for (const d of snapshot.officialDistances)
    await client.query(
      "INSERT INTO official_distances(address_id,school_id,exercise_year,payload,authorised) VALUES($1,$2,$3,$4,true) ON CONFLICT(address_id,school_id,exercise_year) DO UPDATE SET payload=excluded.payload,authorised=true",
      [d.addressId, d.schoolId, d.year, d],
    );
  await client.query(
    "INSERT INTO dataset_versions(version,report) VALUES($1,$2)",
    [snapshot.version, snapshot.report],
  );
  await client.query("COMMIT");
  console.log(`Published ${snapshot.version}`);
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  client.release();
  await pool.end();
}
