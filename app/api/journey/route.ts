import { z } from "zod";
import { getHomePlace } from "@/lib/housing/repository";
import { getPlaces } from "@/lib/repository";
import { locateAddress } from "@/lib/housing/onemap";
import { database } from "@/lib/db";
import { anonymousKey } from "@/lib/limits";
const schema = z.object({
  homeId: z.string().regex(/^(ura-|hdb-sale-)[a-f0-9]{24}$/),
  schoolId: z.string().max(120),
  mode: z.enum(["walk", "pt"]).default("walk"),
  date: z.string().date().optional(),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default("07:00"),
});
export async function POST(request: Request) {
  if (!process.env.ONEMAP_TOKEN)
    return Response.json(
      { error: "Route estimates are not connected." },
      { status: 503 },
    );
  try {
    const raw = await request.text();
    if (raw.length > 2000)
      return Response.json({ error: "Request too large." }, { status: 413 });
    const input = schema.safeParse(JSON.parse(raw));
    if (!input.success)
      return Response.json(
        { error: "Choose valid journey details." },
        { status: 400 },
      );
    const { homeId, schoolId, mode, date, time } = input.data;
    const rate = await database().query(
      `INSERT INTO request_limits(key,minute,count) VALUES($1,date_trunc('minute',now()),1) ON CONFLICT(key,minute) DO UPDATE SET count=request_limits.count+1 WHERE request_limits.count<20 RETURNING count`,
      ["journey:" + anonymousKey(request)],
    );
    if (!rate.rowCount)
      return Response.json(
        { error: "Please wait a minute before requesting another journey." },
        { status: 429 },
      );
    const home = await getHomePlace(homeId),
      school = (await getPlaces()).find(
        (p) => p.id === schoolId && p.category === "school",
      );
    if (!home || !school)
      return Response.json(
        { error: "Choose a known home and school." },
        { status: 400 },
      );
    const start = home.coordinates ?? (await locateAddress(home.address));
    // Resolve the school's exact postal address rather than routing to an illustrative point.
    const end =
      school.quality === "official"
        ? school.coordinates
        : await locateAddress(school.address, school.postalCode);
    if (!start || !end)
      return Response.json(
        {
          error:
            "An exact map location could not be resolved for this journey.",
        },
        { status: 422 },
      );
    const params = new URLSearchParams({
      start: `${start[1]},${start[0]}`,
      end: `${end[1]},${end[0]}`,
      routeType: mode,
    });
    if (mode === "pt") {
      if (!date || !Number.isFinite(Date.parse(date)))
        return Response.json(
          { error: "Select a travel date." },
          { status: 400 },
        );
      const [y, m, d] = date.split("-");
      params.set("date", `${m}-${d}-${y}`);
      params.set("time", time + ":00");
      params.set("mode", "TRANSIT");
      params.set("numItineraries", "1");
      params.set("maxWalkDistance", "1500");
    }
    const r = await fetch(
      "https://www.onemap.gov.sg/api/public/routingsvc/route?" + params,
      {
        headers: {
          Authorization: process.env.ONEMAP_TOKEN,
          "User-Agent": "NearSchool/1.0",
        },
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
      },
    );
    if (!r.ok) throw new Error("Route unavailable");
    const body = await r.json();
    const itinerary = body.plan?.itineraries?.[0];
    const seconds =
      mode === "walk" ? body.route_summary?.total_time : itinerary?.duration;
    const metres =
      mode === "walk"
        ? body.route_summary?.total_distance
        : itinerary?.walkDistance;
    if (!Number.isFinite(seconds) || !Number.isFinite(metres))
      throw new Error("No route");
    return Response.json(
      {
        seconds,
        metres,
        mode,
        transfers: itinerary?.transfers ?? 0,
        hasTransit:
          mode === "pt" &&
          Array.isArray(itinerary?.legs) &&
          itinerary.legs.some(
            (leg: { transitLeg?: boolean; mode?: string }) =>
              leg.transitLeg || (leg.mode && leg.mode !== "WALK"),
          ),
        date,
        time,
        source: "https://www.onemap.gov.sg/",
        note:
          mode === "pt"
            ? "Total scheduled journey; distance is walking segments only."
            : "Walking estimate between map points.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        error:
          "OneMap could not provide this journey. The token may have expired, or a route may be unavailable.",
      },
      { status: 503 },
    );
  }
}
