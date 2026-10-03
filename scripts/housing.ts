import { locateAddress } from "../lib/housing/onemap";
import { parse } from "csv-parse/sync";
import { database } from "../lib/db";
import { fetchUra } from "../lib/housing/ura";
import {
  normalizeUra,
  normalizeHdb,
  type Project,
  type Transaction,
} from "../lib/housing/normalize";
const db = database();
async function publish(
  source: string,
  projects: Project[],
  transactions: Transaction[],
) {
  if (!projects.length || !transactions.length)
    throw new Error("Empty housing snapshot");
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(240920)");
    // Replace a complete source snapshot atomically. Failed fetch/validation leaves old data intact.
    await client.query("DELETE FROM housing_projects WHERE kind=$1", [
      source === "URA" ? "private" : "hdb",
    ]);
    for (let i = 0; i < projects.length; i += 1000)
      await client.query(
        `INSERT INTO housing_projects(id,name,address,kind,location,source_url,refreshed_at)
 SELECT id,name,address,kind,CASE WHEN coordinates IS NOT NULL THEN ST_SetSRID(ST_MakePoint((coordinates->>0)::float8,(coordinates->>1)::float8),4326)::geography ELSE NULL END,"sourceUrl",now()
 FROM jsonb_to_recordset($1::jsonb) AS x(id text,name text,address text,kind text,coordinates jsonb,"sourceUrl" text)`,
        [JSON.stringify(projects.slice(i, i + 1000))],
      );
    for (let i = 0; i < transactions.length; i += 4000)
      await client.query(
        `INSERT INTO housing_transactions SELECT id,"projectId",month::date,price,area,"propertyType","areaType",tenure,"saleType","floorRange",units
 FROM jsonb_to_recordset($1::jsonb) AS x(id text,"projectId" text,month text,price numeric,area numeric,"propertyType" text,"areaType" text,tenure text,"saleType" text,"floorRange" text,units int)`,
        [JSON.stringify(transactions.slice(i, i + 4000))],
      );
    await client.query(
      "INSERT INTO housing_refreshes VALUES($1,now(),$2,$3) ON CONFLICT(source) DO UPDATE SET refreshed_at=now(),projects=$2,transactions=$3",
      [source, projects.length, transactions.length],
    );
    await client.query("COMMIT");
    console.log(
      JSON.stringify({
        source,
        projects: projects.length,
        transactions: transactions.length,
      }),
    );
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
try {
  const ura = normalizeUra(await fetchUra(process.env.URA_ACCESS_KEY ?? ""));
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 5);
  cutoff.setUTCDate(1);
  await publish(
    "URA",
    ura.projects,
    ura.transactions.filter(
      (t) => t.month >= cutoff.toISOString().slice(0, 10),
    ),
  );
  const dataset = "d_8b84c4ee58e3cfc0ece0d773c8ca6abc";
  const meta = await fetch(
    `https://api-open.data.gov.sg/v1/public/api/datasets/${dataset}/poll-download`,
    { signal: AbortSignal.timeout(30000) },
  );
  if (!meta.ok) throw new Error("HDB metadata unavailable");
  const link = (await meta.json()).data?.url;
  if (!link || new URL(link).protocol !== "https:")
    throw new Error("HDB download not ready");
  const response = await fetch(link, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error("HDB download failed");
  const rows = parse(await response.text(), {
    columns: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];
  const hdb = normalizeHdb(
    rows.filter((r) => r.month >= cutoff.toISOString().slice(0, 7)),
  );
  const cached = new Map(
    (
      await db.query(
        "SELECT address,coordinates FROM housing_geocodes WHERE coordinates <> 'null'::jsonb OR verified_at > now() - interval '30 days'",
      )
    ).rows.map((r) => [r.address, r.coordinates as [number, number] | null]),
  );
  for (const p of hdb.projects) p.coordinates = cached.get(p.address) ?? null;
  if (process.env.ONEMAP_TOKEN) {
    const priority =
      /MARINE|JOO CHIAT|FARRER|BUKIT TIMAH|QUEEN|CLEMENTI|GHIM MOH|DOVER|HOLLAND|BEDOK|TELOK KURAU|KALLANG|WHAMPOA/;
    const pending = hdb.projects
      .filter((p) => !cached.has(p.address))
      .sort(
        (a, b) =>
          Number(priority.test(b.address)) - Number(priority.test(a.address)),
      )
      .slice(0, 500);
    let resolved = 0;
    for (const p of pending) {
      try {
        p.coordinates = await locateAddress(p.address);
        // Cache unresolved matches too, so later runs progress through new addresses.
        await db.query(
          "INSERT INTO housing_geocodes(address,coordinates) VALUES($1,$2) ON CONFLICT(address) DO UPDATE SET coordinates=$2,verified_at=now()",
          [p.address, JSON.stringify(p.coordinates)],
        );
        if (p.coordinates) resolved++;
      } catch {
        console.warn(JSON.stringify({ event: "geocoding_paused", resolved }));
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    console.log(
      JSON.stringify({
        event: "hdb_geometry",
        mapped: hdb.projects.filter((p) => p.coordinates).length,
        total: hdb.projects.length,
      }),
    );
  }
  await publish("HDB", hdb.projects, hdb.transactions);
} finally {
  await db.end();
}
