import { z } from "zod";
import { findPlaces, getDistance, searchPolicies } from "./repository";
import { registrationTrack } from "./rules";
import {
  actionSchema,
  type MapAction,
  type MapContext,
  type Place,
} from "./types";
const findSchema = z.object({
  query: z.string().max(150).optional(),
  nearId: z.string().optional(),
  radiusMetres: z.number().min(100).max(5000).optional(),
  twoTrackOnly: z.boolean().optional(),
});
export const toolSchemas = {
  findSchools: findSchema,
  findHdbBlocks: findSchema.omit({ twoTrackOnly: true }),
  findAmenities: findSchema
    .omit({ twoTrackOnly: true })
    .extend({
      categories: z
        .array(z.enum(["childcare", "park", "hawker", "transit"]))
        .min(1),
    }),
  getOfficialDistanceCategory: z.object({
    schoolId: z.string(),
    addressId: z.string(),
  }),
  searchPolicy: z.object({ query: z.string().max(500) }),
};
export async function runTool(
  name: string,
  args: unknown,
  context: MapContext,
  places: Place[],
) {
  if (!(name in toolSchemas)) throw new Error("Unsupported tool");
  if (name === "getOfficialDistanceCategory") {
    const input = toolSchemas.getOfficialDistanceCategory.parse(args);
    const school = places.find(
      (p) => p.id === input.schoolId && p.category === "school",
    );
    if (!school) throw new Error("Unknown school");
    const record = await getDistance(
      input.addressId,
      input.schoolId,
      context.year,
    );
    return {
      ...registrationTrack(school, record, context.year),
      source: record?.sourceUrl ?? "https://www.onemap.gov.sg/",
      year: context.year,
    };
  }
  if (name === "searchPolicy")
    return searchPolicies(
      toolSchemas.searchPolicy.parse(args).query,
      context.year,
    );
  const input = toolSchemas[name as keyof typeof toolSchemas].parse(
    args,
  ) as z.infer<typeof findSchema> & {
    categories?: ("childcare" | "park" | "hawker" | "transit")[];
  };
  return findPlaces(
    {
      ...input,
      year: context.year,
      categories:
        name === "findSchools"
          ? ["school"]
          : name === "findHdbBlocks"
            ? ["hdb"]
            : input.categories,
    },
    places,
  );
}
export function validateActions(raw: unknown[], places: Place[]): MapAction[] {
  const ids = new Set(places.map((p) => p.id));
  return raw
    .map((a) => actionSchema.parse(a))
    .map((a) => {
      if ("ids" in a && a.ids.some((id) => !ids.has(id)))
        throw new Error("Map action references an unknown location");
      return a;
    });
}
