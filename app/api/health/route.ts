import { database } from "@/lib/db";
export async function GET() {
  try {
    if (process.env.DATA_MODE === "live") await database().query("SELECT 1");
    return Response.json({
      status: "ok",
      dataMode: process.env.DATA_MODE ?? "demo",
      aiMode: process.env.AI_MODE ?? "demo",
      revision: process.env.K_REVISION ?? "local",
    });
  } catch {
    return Response.json({ status: "degraded" }, { status: 503 });
  }
}
