import { placeSchema, type Place } from "@/lib/types";
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query || query.length < 3 || query.length > 150)
    return Response.json(
      { error: "Enter an address or six-digit postal code." },
      { status: 400 },
    );
  if (!process.env.ONEMAP_TOKEN)
    return Response.json(
      {
        error:
          "Live address search is not connected. Explore the sample HDB blocks instead.",
      },
      { status: 503 },
    );
  try {
    const response = await fetch(
      `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(query)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`,
      {
        headers: { Authorization: process.env.ONEMAP_TOKEN },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      },
    );
    if (!response.ok) throw new Error("OneMap unavailable");
    const body = await response.json();
    const places: Place[] = (body.results ?? [])
      .slice(0, 8)
      .map((r: Record<string, string>) => ({
        id: `address-${r.POSTAL}-${r.X}-${r.Y}`,
        name: r.BUILDING === "NIL" ? r.ADDRESS : r.BUILDING,
        address: r.ADDRESS,
        postalCode: r.POSTAL,
        coordinates: [Number(r.LONGITUDE), Number(r.LATITUDE)],
        category: "address",
        quality: "official",
        sourceUrl: "https://www.onemap.gov.sg/",
        updatedAt: new Date().toISOString().slice(0, 10),
      }));
    return Response.json(
      { places: placeSchema.array().parse(places) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        error: "OneMap address search is unavailable. Please try again later.",
      },
      { status: 503 },
    );
  }
}
