import { describe, it, expect, vi, afterEach } from "vitest";
import {
  normalizeUra,
  normalizeHdb,
  svy21,
  uraMonth,
} from "../lib/housing/normalize";
import { housingFilterSchema } from "../lib/housing/types";
const transaction = {
  contractDate: "0926",
  area: "100",
  price: "1500000",
  propertyType: "Condominium",
  typeOfArea: "Strata",
  tenure: "Freehold",
  floorRange: "01-05",
  typeOfSale: "3",
  district: "10",
  noOfUnits: "1",
};
describe("housing source normalization", () => {
  it("converts the SVY21 origin to the expected longitude and latitude", () => {
    const [lng, lat] = svy21(28001.642, 38744.572);
    expect(lng).toBeCloseTo(103.833333333, 6);
    expect(lat).toBeCloseTo(1.3666666667, 6);
  });
  it("retains identical-looking source sales without collapsing them", () => {
    const data = normalizeUra([
      {
        project: "Example",
        street: "Example Road",
        x: "28001.642",
        y: "38744.572",
        transaction: [transaction, transaction],
      },
    ]);
    expect(data.transactions).toHaveLength(2);
    expect(new Set(data.transactions.map((t) => t.id)).size).toBe(2);
    expect(data.transactions[0].month).toBe("2026-09-01");
  });
  it("combines repeated project rows without losing distinct transaction occurrences", () => {
    const row = {
      project: "Example",
      street: "Example Road",
      x: "28001.642",
      y: "38744.572",
      transaction: [transaction],
    };
    const data = normalizeUra([row, row]);
    expect(data.projects).toHaveLength(1);
    expect(data.transactions).toHaveLength(2);
    expect(new Set(data.transactions.map((t) => t.id)).size).toBe(2);
  });
  it("rejects invalid prices and months instead of publishing misleading data", () => {
    expect(() => uraMonth("1326")).toThrow();
    expect(() =>
      normalizeUra([
        {
          project: "Example",
          street: "Road",
          transaction: [{ ...transaction, price: "NaN" }],
        },
      ]),
    ).toThrow();
  });
  it("keeps HDB addresses unlocated until an exact match is established", () => {
    const data = normalizeHdb([
      {
        month: "2026-09",
        block: "1",
        street_name: "EXAMPLE RD",
        resale_price: "600000",
        floor_area_sqm: "90",
        flat_type: "4 ROOM",
        lease_commence_date: "2000",
        storey_range: "01 TO 03",
      },
    ]);
    expect(data.projects[0].coordinates).toBeNull();
    expect(data.transactions[0].saleType).toBe("resale");
  });
  it("bounds public filters", () => {
    expect(housingFilterSchema.safeParse({ months: 1000 }).success).toBe(false);
    expect(housingFilterSchema.safeParse({ maxPrice: -1 }).success).toBe(false);
    expect(housingFilterSchema.parse({}).saleType).toBe("resale");
  });
});

describe("OneMap exact address matching", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it("selects the postal building over a co-located POI without a postal address", async () => {
    vi.stubEnv("ONEMAP_TOKEN", "test-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            {
              BLK_NO: "52",
              ROAD_NAME: "KING'S ROAD",
              POSTAL: "NIL",
              LATITUDE: "1.321",
              LONGITUDE: "103.808",
            },
            {
              BLK_NO: "52",
              ROAD_NAME: "KING'S ROAD",
              POSTAL: "268097",
              LATITUDE: "1.3208",
              LONGITUDE: "103.8077",
            },
          ],
        }),
      }),
    );
    const { locateAddress } = await import("../lib/housing/onemap");
    expect(await locateAddress("52 King's Road")).toEqual([103.8077, 1.3208]);
  });
});
