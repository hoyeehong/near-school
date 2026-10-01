import { describe, it, expect, afterAll } from "vitest";
import { database } from "../lib/db";
import { reserveAiRequest } from "../lib/limits";
import { readFile } from "node:fs/promises";
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "PostgreSQL integration",
  () => {
    if (process.env.TEST_DATABASE_URL)
      process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    afterAll(async () => {
      if (process.env.TEST_DATABASE_URL) await database().end();
    });
    it("enables real PostGIS metre queries and vector operations", async () => {
      const { rows } = await database().query(
        "SELECT ST_DWithin(ST_SetSRID(ST_MakePoint(103.8,1.3),4326)::geography,ST_SetSRID(ST_MakePoint(103.8,1.31),4326)::geography,1000) AS nearby, '[1,0,0]'::vector <=> '[1,0,0]'::vector AS distance",
      );
      expect(rows[0].nearby).toBe(false);
      expect(rows[0].distance).toBe(0);
    });
    it("enforces a shared atomic budget under concurrent requests", async () => {
      await database().query("TRUNCATE ai_budget,request_limits");
      process.env.AI_MONTHLY_BUDGET_SGD = "0.10";
      process.env.AI_REQUEST_RESERVATION_SGD = "0.05";
      const results = await Promise.allSettled(
        Array.from({ length: 6 }, (_, i) => reserveAiRequest(`test-${i}`)),
      );
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
      const { rows } = await database().query(
        "SELECT reserved_sgd FROM ai_budget",
      );
      expect(Number(rows[0].reserved_sgd)).toBe(0.1);
    });
    it("removes runtime role administration while preserving application grants", async () => {
      await database().query(
        "CREATE ROLE nearschool_runtime CREATEDB CREATEROLE",
      );
      try {
        for (const file of [
          "002_runtime_role.sql",
          "003_runtime_attributes.sql",
        ])
          await database().query(await readFile(`migrations/${file}`, "utf8"));
        const { rows } = await database().query(
          "SELECT rolcreatedb,rolcreaterole,has_table_privilege('nearschool_runtime','places','SELECT') AS can_read,has_table_privilege('nearschool_runtime','places','UPDATE') AS can_publish,has_table_privilege('nearschool_runtime','ai_budget','UPDATE') AS can_budget FROM pg_roles WHERE rolname='nearschool_runtime'",
        );
        expect(rows[0]).toEqual({
          rolcreatedb: false,
          rolcreaterole: false,
          can_read: true,
          can_publish: false,
          can_budget: true,
        });
      } finally {
        await database().query("DROP OWNED BY nearschool_runtime");
        await database().query("DROP ROLE nearschool_runtime");
      }
    });
  },
);
