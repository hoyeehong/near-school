import { z } from "zod";
export const categories = [
  "school",
  "hdb",
  "address",
  "childcare",
  "park",
  "hawker",
  "transit",
] as const;
export const categorySchema = z.enum(categories);
export type Category = z.infer<typeof categorySchema>;
export const placeSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: categorySchema,
  address: z.string(),
  postalCode: z.string().optional(),
  coordinates: z
    .tuple([z.number().min(103).max(105), z.number().min(1).max(2)])
    .nullable(),
  twoTrackFrom: z.number().optional(),
  sourceUrl: z.url(),
  updatedAt: z.string(),
  quality: z.enum(["official", "illustrative"]),
});
export type Place = z.infer<typeof placeSchema>;
export type DistanceBand = "within-1km" | "between-1-and-2km" | "beyond-2km";
export type OfficialDistance = {
  schoolId: string;
  addressId: string;
  year: number;
  band: DistanceBand;
  sourceUrl: string;
  verifiedAt: string;
};
export type Policy = {
  id: string;
  title: string;
  text: string;
  sourceUrl: string;
  fromYear: number;
  toYear: number | null;
};
export const contextSchema = z.object({
  year: z.union([z.literal(2026), z.literal(2027)]).default(2027),
  selectedId: z.string().max(120).nullable().default(null),
  addressId: z.string().max(200).nullable().default(null),
  visibleIds: z.array(z.string().max(120)).max(500).default([]),
  categories: z.array(categorySchema).max(7).default(["school"]),
});
export type MapContext = z.infer<typeof contextSchema>;
export const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("selectFeatures"),
    ids: z.array(z.string()).max(500),
  }),
  z.object({
    type: z.literal("setLayers"),
    categories: z.array(categorySchema),
  }),
  z.object({ type: z.literal("fitBounds"), ids: z.array(z.string()).max(500) }),
]);
export type MapAction = z.infer<typeof actionSchema>;
export type ChatResponse = {
  answer: string;
  citations: { title: string; url: string }[];
  actions: MapAction[];
  mode: "demo" | "live";
  requestId?: string;
};
