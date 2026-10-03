import { housingFilterSchema } from "@/lib/housing/types";
import { findHomes } from "@/lib/housing/repository";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const input = housingFilterSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!input.success)
    return Response.json(
      { error: "Choose valid housing filters." },
      { status: 400 },
    );
  try {
    return Response.json(await findHomes(input.data), {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch {
    return Response.json(
      { error: "Housing data is temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
}
