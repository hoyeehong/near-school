import { describe, it, expect, afterEach, vi } from "vitest";
import { registrationTrack, metresBetween } from "../lib/rules";
import { demoPlaces } from "../data/demo";
import { demoChat } from "../lib/demo-chat";
import { validateActions } from "../lib/tools";
import type { MapContext, OfficialDistance } from "../lib/types";
import { findPlaces, searchPolicies } from "../lib/repository";
const school = { id: "nanyang", twoTrackFrom: 2027 };
const record: OfficialDistance = {
  schoolId: "nanyang",
  addressId: "building-1",
  year: 2027,
  band: "between-1-and-2km",
  sourceUrl: "https://www.onemap.gov.sg/",
  verifiedAt: "2026-09-19",
};
const context: MapContext = {
  year: 2027,
  selectedId: null,
  addressId: null,
  visibleIds: [],
  categories: ["school"],
};
afterEach(() => vi.unstubAllEnvs());
describe("official category boundary", () => {
  it("joins the official 1km and 1–2km bands only at designated schools from 2027", () => {
    expect(registrationTrack(school, record, 2027).track).toBe("near");
    expect(
      registrationTrack(school, { ...record, band: "within-1km" }, 2027).track,
    ).toBe("near");
    expect(
      registrationTrack(school, { ...record, band: "beyond-2km" }, 2027).track,
    ).toBe("far");
    expect(registrationTrack({ id: "nanyang" }, record, 2027).track).toBe(
      "between-1-and-2km",
    );
    expect(
      registrationTrack(school, { ...record, year: 2026 }, 2026).track,
    ).toBe("between-1-and-2km");
  });
  it("fails closed for absent, wrong-year and wrong-school classifications", () => {
    expect(registrationTrack(school, null, 2027).verified).toBe(false);
    expect(
      registrationTrack(school, { ...record, year: 2026 }, 2027).verified,
    ).toBe(false);
    expect(
      registrationTrack(school, { ...record, schoolId: "rgps" }, 2027).verified,
    ).toBe(false);
  });
});
describe("spatial and conversational behaviour", () => {
  it("measures amenity metres and never creates an official category", () => {
    expect(metresBetween([103.8, 1.3], [103.8, 1.3])).toBe(0);
    expect(metresBetween([103.8, 1.3], [103.8, 1.31])).toBeGreaterThan(1100);
  });
  it("selects all 12 two-track schools, without inventing map IDs", async () => {
    const result = await demoChat(
      "Show the two-track schools",
      context,
      demoPlaces,
    );
    const action = result.actions.find((a) => a.type === "selectFeatures");
    expect(action && "ids" in action && action.ids.length).toBe(12);
    expect(() => validateActions(result.actions, demoPlaces)).not.toThrow();
  });
  it("does not apply next year's scheme to 2026", async () => {
    const result = await demoChat(
      "Show the two-track schools",
      { ...context, year: 2026 },
      demoPlaces,
    );
    expect(result.actions.find((a) => a.type === "selectFeatures")).toEqual({
      type: "selectFeatures",
      ids: [],
    });
    expect(result.answer).toContain("begins in 2027");
  });
  it("requires a place for an ambiguous nearby query", async () => {
    expect(
      (await demoChat("Find parks nearby", context, demoPlaces)).actions,
    ).toEqual([]);
  });
  it("uses map selection for contextual follow-up", async () => {
    const result = await demoChat(
      "Find parks nearby",
      { ...context, selectedId: "nanyang" },
      demoPlaces,
    );
    const action = result.actions.find((a) => a.type === "selectFeatures");
    expect(action && "ids" in action && action.ids).toContain("farrer-park");
  });
  it("rejects unknown IDs, executable actions and out-of-scope map categories", () => {
    expect(() =>
      validateActions(
        [{ type: "fitBounds", ids: ["invented-school"] }],
        demoPlaces,
      ),
    ).toThrow();
    expect(() =>
      validateActions([{ type: "eval", code: "alert(1)" }], demoPlaces),
    ).toThrow();
    expect(() =>
      validateActions(
        [{ type: "setLayers", categories: ["secret"] }],
        demoPlaces,
      ),
    ).toThrow();
  });
  it("returns no nearby records if the origin is unknown", async () => {
    expect(
      await findPlaces({ categories: ["park"], nearId: "unknown" }, demoPlaces),
    ).toEqual([]);
  });
  it("filters retrieved policy by effective year", async () => {
    const docs = await searchPolicies("two tracks", 2026);
    expect(docs.some((d) => d.id === "two-tracks")).toBe(false);
  });
});
