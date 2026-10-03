import { describe, expect, it } from "vitest";
import { compactToolResult } from "../lib/ai";
describe("housing assistant evidence", () => {
  it("retains transaction statistics and distinguishes location totals from sales counts", () => {
    const housing = {
      count: 8,
      medianPrice: 1800000,
      filterSummary: "Last 12 months · resale",
      firstMonth: "2026-01",
      latestMonth: "2026-09",
    };
    const compact = compactToolResult("findHomes", {
      total: 120,
      homes: [
        {
          id: "ura-test",
          name: "Test Gardens",
          category: "home",
          quality: "official",
          housing,
        },
      ],
      filters: { months: 12, saleType: "resale" },
      refreshedAt: "2026-10-04",
      sources: ["URA"],
    }) as {
      totalMatchingLocations: number;
      returnedLocations: number;
      places: { housing: typeof housing }[];
    };
    expect(compact.totalMatchingLocations).toBe(120);
    expect(compact.returnedLocations).toBe(1);
    expect(compact.places[0].housing).toEqual(housing);
    expect(compact).not.toHaveProperty("count");
  });
  it("preserves explicit tool failure evidence", () => {
    expect(compactToolResult("findHomes", { error: "Unavailable" })).toEqual({
      error: "Unavailable",
    });
  });
});
