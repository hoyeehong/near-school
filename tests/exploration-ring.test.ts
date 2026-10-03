import { describe, expect, it } from "vitest";
import { explorationRing } from "../lib/exploration-ring";
import { metresBetween } from "../lib/rules";

describe("exploration perimeter", () => {
  for (const metres of [1000, 2000]) {
    it(`closes a ${metres} metre perimeter around a Singapore point`, () => {
      const center: [number, number] = [103.804, 1.321];
      const points = explorationRing(center, metres).geometry.coordinates[0];
      expect(points).toHaveLength(129);
      expect(points[0]).toEqual(points.at(-1));
      for (const point of points)
        expect(metresBetween(center, [point[0], point[1]])).toBeCloseTo(
          metres,
          4,
        );
      expect(Math.min(...points.map((p) => p[0]))).toBeLessThan(center[0]);
      expect(Math.max(...points.map((p) => p[1]))).toBeGreaterThan(center[1]);
    });
  }
});
