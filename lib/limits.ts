import { createHmac } from "node:crypto";
import { database } from "./db";
export function anonymousKey(request: Request) {
  const salt = process.env.RATE_LIMIT_SALT;
  if (!salt || salt.length < 16)
    throw new Error("RATE_LIMIT_SALT must contain at least 16 characters");
  // Cloud Run adds the connecting client near the end of the forwarded chain.
  const chain =
    request.headers
      .get("x-forwarded-for")
      ?.split(",")
      .map((s) => s.trim()) ?? [];
  const ip =
    chain.length >= 2 ? chain[chain.length - 2] : (chain[0] ?? "unknown");
  return createHmac("sha256", salt).update(ip).digest("hex");
}
export async function reserveAiRequest(key: string) {
  const limit = Number(process.env.AI_MONTHLY_BUDGET_SGD ?? 30),
    cost = Number(process.env.AI_REQUEST_RESERVATION_SGD ?? 0.25);
  if (!(cost > 0 && limit > 0 && cost <= limit))
    throw new Error("Invalid AI budget configuration");
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const rate = await client.query(
      "INSERT INTO request_limits (key,minute,count) VALUES ($1,date_trunc('minute',now()),1) ON CONFLICT (key,minute) DO UPDATE SET count=request_limits.count+1 WHERE request_limits.count<6 RETURNING count",
      [key],
    );
    if (!rate.rowCount) throw new Error("RATE_LIMIT");
    const budget = await client.query(
      "INSERT INTO ai_budget (month,reserved_sgd) VALUES (date_trunc('month',now())::date,$1) ON CONFLICT (month) DO UPDATE SET reserved_sgd=ai_budget.reserved_sgd+$1 WHERE ai_budget.reserved_sgd+$1 <= $2 RETURNING reserved_sgd",
      [cost, limit],
    );
    if (!budget.rowCount) throw new Error("BUDGET_LIMIT");
    await client.query("COMMIT");
    // Reservation is intentionally retained even on provider timeout; no undercounting.
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
