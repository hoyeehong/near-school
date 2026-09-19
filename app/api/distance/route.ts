import { getDistance, getPlaces } from "@/lib/repository";
import { registrationTrack } from "@/lib/rules";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams,
    year = Number(params.get("year"));
  if (
    ![2026, 2027].includes(year) ||
    !params.get("schoolId") ||
    !params.get("addressId")
  )
    return Response.json(
      { error: "School, address and year required" },
      { status: 400 },
    );
  try {
    const school = (await getPlaces()).find(
      (p) => p.id === params.get("schoolId") && p.category === "school",
    );
    if (!school)
      return Response.json({ error: "Unknown school" }, { status: 404 });
    const record = await getDistance(params.get("addressId")!, school.id, year);
    return Response.json(
      {
        ...registrationTrack(school, record, year),
        sourceUrl: record?.sourceUrl,
        verifiedAt: record?.verifiedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Official distance lookup unavailable" },
      { status: 503 },
    );
  }
}
