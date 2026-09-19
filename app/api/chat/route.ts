import { z } from "zod";
import { contextSchema } from "@/lib/types";
import { getPlaces } from "@/lib/repository";
import { demoChat } from "@/lib/demo-chat";
import { liveChat } from "@/lib/ai";
import { anonymousKey, reserveAiRequest } from "@/lib/limits";
export const runtime = "nodejs";
const inputSchema = z.object({
  message: z.string().trim().min(1).max(1500),
  context: contextSchema,
});
export async function POST(request: Request) {
  const requestId = crypto.randomUUID(),
    start = Date.now();
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 16000)
      return Response.json({ error: "Request too large" }, { status: 413 });
    const raw = await request.text();
    if (raw.length > 16000)
      return Response.json({ error: "Request too large" }, { status: 413 });
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return Response.json({ error: "Invalid JSON request" }, { status: 400 });
    }
    const input = inputSchema.safeParse(parsed);
    if (!input.success)
      return Response.json(
        { error: "Enter a question and valid map context." },
        { status: 400 },
      );
    const places = await getPlaces();
    let result;
    if (process.env.AI_MODE === "live") {
      await reserveAiRequest(anonymousKey(request));
      result = await liveChat(input.data.message, input.data.context, places);
    } else
      result = await demoChat(input.data.message, input.data.context, places);
    console.info(
      JSON.stringify({
        requestId,
        event: "chat",
        durationMs: Date.now() - start,
        mode: result.mode,
        actions: result.actions.map((a) => a.type),
      }),
    );
    return Response.json(
      { ...result, requestId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const code = e instanceof Error ? e.message : "UNAVAILABLE";
    console.error(
      JSON.stringify({
        requestId,
        event: "chat_failed",
        code: ["RATE_LIMIT", "BUDGET_LIMIT"].includes(code)
          ? code
          : "UPSTREAM_ERROR",
      }),
    );
    return Response.json(
      {
        error:
          code === "RATE_LIMIT"
            ? "Too many questions. Please wait a minute."
            : code === "BUDGET_LIMIT"
              ? "The demo’s AI allowance is used up. Map search and filters are still available."
              : "The assistant is unavailable. Please use the map filters and source links.",
        requestId,
      },
      { status: code.endsWith("LIMIT") ? 429 : 503 },
    );
  }
}
