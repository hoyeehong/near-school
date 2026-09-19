import { readdir, readFile } from "node:fs/promises";
import { database } from "../lib/db";
const pool = database(),
  client = await pool.connect();
try {
  await client.query("SELECT pg_advisory_lock(240919)");
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const file of (await readdir("migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    if (
      (
        await client.query("SELECT 1 FROM schema_migrations WHERE name=$1", [
          file,
        ])
      ).rowCount
    )
      continue;
    await client.query("BEGIN");
    try {
      await client.query(await readFile(`migrations/${file}`, "utf8"));
      await client.query("INSERT INTO schema_migrations(name) VALUES($1)", [
        file,
      ]);
      await client.query("COMMIT");
      console.log(`Applied ${file}`);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }
} finally {
  await client.query("SELECT pg_advisory_unlock(240919)");
  client.release();
  await pool.end();
}
