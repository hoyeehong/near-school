import { policies } from "@/data/demo";
import { findPlaces } from "./repository";
import { registrationTrack } from "./rules";
import type { ChatResponse, MapContext, Place, Category } from "./types";
/** Deterministic, explicitly labelled local demo. Not presented as a live model. */
export async function demoChat(
  message: string,
  context: MapContext,
  places: Place[],
): Promise<ChatResponse> {
  const lower = message.toLowerCase();
  const selected = places.find((p) => p.id === context.selectedId);
  const named = places.filter(
    (p) =>
      lower.includes(p.name.toLowerCase()) ||
      (p.id.length > 4 && lower.includes(p.id)),
  );
  const origin = named[0] ?? selected;
  const policy = policies.filter(
    (p) =>
      p.fromYear <= context.year && (!p.toYear || p.toYear >= context.year),
  );
  const citations = policy
    .slice(0, 2)
    .map((p) => ({ title: p.title, url: p.sourceUrl }));
  if (/my.*track|which track|distance category/.test(lower))
    return {
      mode: "demo",
      answer: `${origin?.name ?? "This address"}: ${registrationTrack(origin ?? { id: "unknown" }, null, context.year).label}. No official address-school distance records are bundled in this demo. Check the exact building in OneMap SchoolQuery for the registration year.`,
      citations: [
        { title: "Verify with OneMap", url: "https://www.onemap.gov.sg/" },
      ],
      actions: [],
    };
  if (
    /why|explain|equal|chance|rule|priority/.test(lower) &&
    !/show|find/.test(lower)
  )
    return {
      mode: "demo",
      answer:
        context.year === 2027
          ? "At the 12 participating schools, Phase 2C places are split into ≤2 km and >2 km tracks. Distance gives no extra priority inside a track. Singapore Citizens across both tracks are considered before PRs. Equal allocation is not equal admission probability; demand and transfers of remaining places matter."
          : "The two-track scheme starts with the 2027 registration exercise, for 2028 entry. In 2026, standard citizenship and distance priority applies.",
      citations,
      actions: [],
    };
  const categories: Category[] = [];
  if (/hdb|housing|flat|block/.test(lower)) categories.push("hdb");
  if (/park|green/.test(lower)) categories.push("park");
  if (/childcare|child care/.test(lower)) categories.push("childcare");
  if (/hawker|food|market/.test(lower)) categories.push("hawker");
  if (/mrt|lrt|station|transit/.test(lower)) categories.push("transit");
  if (/amenit/.test(lower))
    categories.push("park", "childcare", "hawker", "transit");
  const nearby = /near|around/.test(lower) && categories.length > 0;
  if (nearby && !origin)
    return {
      mode: "demo",
      answer:
        "Select a school or HDB block first, then ask for nearby amenities. The map and conversation share your selection.",
      citations: [],
      actions: [],
    };
  const twoTrackOnly = /two.track|12 schools|participating/.test(lower);
  if (!categories.length) categories.push("school");
  const results = await findPlaces(
    {
      categories,
      twoTrackOnly,
      year: context.year,
      nearId: nearby ? origin?.id : undefined,
      radiusMetres: 1000,
    },
    places,
  );
  if (
    !/show|find|near|around|school|hdb|park|childcare|hawker|mrt|amenit/.test(
      lower,
    )
  )
    return {
      mode: "demo",
      answer:
        "This local demo supports school, HDB and amenity searches, plus Phase 2C explanations. Try “Show the two-track schools” or select a school and ask “Find parks nearby”. Connect Vertex AI for open-ended questions.",
      citations: [],
      actions: [],
    };
  const ids = results.map((p) => p.id);
  return {
    mode: "demo",
    answer: results.length
      ? `Showing ${results.length} ${twoTrackOnly ? "two-track schools" : "sample locations"}${nearby ? ` within 1 km of ${origin?.name}` : ""}. ${nearby ? "This is point-to-point amenity distance, not an official registration boundary." : "Select a marker or result to explore its neighbourhood."}`
      : `No matching sample locations${context.year === 2026 && twoTrackOnly ? ": the two-track scheme begins in 2027" : " in this demo area"}.`,
    citations: twoTrackOnly ? citations : [],
    actions: [
      { type: "setLayers", categories },
      { type: "selectFeatures", ids },
      { type: "fitBounds", ids },
    ],
  };
}
