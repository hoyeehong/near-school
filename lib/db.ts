import pg from "pg";
import { Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
const globalDb = globalThis as unknown as {
  poolPromise?: Promise<pg.Pool>;
  connector?: Connector;
};
async function pool() {
  return (globalDb.poolPromise ??= (async () => {
    if (!process.env.DATABASE_URL)
      throw new Error("DATABASE_URL is not configured");
    const config: pg.PoolConfig = {
      max: 5,
      connectionTimeoutMillis: 5000,
      statement_timeout: 8000,
    };
    if (process.env.INSTANCE_CONNECTION_NAME) {
      const url = new URL(process.env.DATABASE_URL);
      const connector = (globalDb.connector ??= new Connector());
      const options = await connector.getOptions({
        instanceConnectionName: process.env.INSTANCE_CONNECTION_NAME,
        ipType: IpAddressTypes.PRIVATE,
      });
      return new pg.Pool({
        ...config,
        ...options,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1),
      });
    }
    return new pg.Pool({
      ...config,
      connectionString: process.env.DATABASE_URL,
    });
  })().catch((e) => {
    globalDb.poolPromise = undefined;
    throw e;
  }));
}
export function database() {
  return {
    query: async (text: string, values?: unknown[]) =>
      (await pool()).query(text, values),
    connect: async () => (await pool()).connect(),
    end: async () => {
      if (globalDb.poolPromise) await (await globalDb.poolPromise).end();
      globalDb.connector?.close();
      globalDb.poolPromise = undefined;
      globalDb.connector = undefined;
    },
  };
}
