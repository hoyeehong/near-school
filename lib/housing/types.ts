import { z } from "zod";
import { placeSchema, type Place } from "../types";
export const housingFilterSchema = z.object({
  query: z.string().max(100).default(""),
  kind: z.enum(["private", "hdb", "all"]).default("private"),
  propertyType: z.string().max(60).default(""),
  maxPrice: z.coerce.number().min(0).max(100000000).default(0),
  minArea: z.coerce.number().min(0).max(10000).default(0),
  months: z.coerce.number().int().min(1).max(60).default(12),
  saleType: z.enum(["resale", "new", "subsale", "all"]).default("resale"),
  nearId: z.string().max(120).default(""),
  radiusMetres: z.coerce.number().min(500).max(10000).default(2000),
  ids: z.string().max(400).default(""),
});
export type HousingFilters = z.infer<typeof housingFilterSchema>;
export type HousingStats = {
  filterSummary: string;
  kind: "private" | "hdb";
  count: number;
  medianPrice: number;
  lowerPrice: number;
  upperPrice: number;
  medianPsf: number | null;
  medianArea: number;
  latestMonth: string;
  firstMonth: string;
  propertyTypes: string[];
  tenures: string[];
  areaTypes: string[];
  saleTypes: string[];
  distanceMetres: number | null;
};
export type Home = Place & { housing: HousingStats };
export type HousingResponse = {
  homes: Home[];
  total: number;
  refreshedAt: string | null;
  filters: HousingFilters;
  sources: string[];
};
export const money = (n: number) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    maximumFractionDigits: 0,
  }).format(n);
export const URA_SOURCE = "https://eservice.ura.gov.sg/maps/api/";
export const HDB_SOURCE =
  "https://data.gov.sg/datasets/d_8b84c4ee58e3cfc0ece0d773c8ca6abc/view";

export const savedHomeSchema = placeSchema.extend({
  category: z.literal("home"),
  housing: z.object({
    filterSummary: z.string(),
    kind: z.enum(["private", "hdb"]),
    count: z.number().int().positive(),
    medianPrice: z.number().positive(),
    lowerPrice: z.number().positive(),
    upperPrice: z.number().positive(),
    medianPsf: z.number().positive().nullable(),
    medianArea: z.number().positive(),
    latestMonth: z.string(),
    firstMonth: z.string(),
    propertyTypes: z.array(z.string()),
    tenures: z.array(z.string()),
    areaTypes: z.array(z.string()),
    saleTypes: z.array(z.string()),
    distanceMetres: z.number().nonnegative().nullable(),
  }),
});
