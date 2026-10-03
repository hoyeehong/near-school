import type { Feature, Polygon } from "geojson";

/** Spherical point-distance outline for exploration, never official HSD. */
export function explorationRing(
  center: [number, number],
  metres: number,
): Feature<Polygon> {
  const rad = Math.PI / 180;
  const latitude = center[1] * rad;
  const longitude = center[0] * rad;
  const distance = metres / 6371008.8;
  const coordinates: [number, number][] = Array.from(
    { length: 128 },
    (_, i) => {
      const bearing = (2 * Math.PI * i) / 128;
      const lat = Math.asin(
        Math.sin(latitude) * Math.cos(distance) +
          Math.cos(latitude) * Math.sin(distance) * Math.cos(bearing),
      );
      const lon =
        longitude +
        Math.atan2(
          Math.sin(bearing) * Math.sin(distance) * Math.cos(latitude),
          Math.cos(distance) - Math.sin(latitude) * Math.sin(lat),
        );
      return [lon / rad, lat / rad];
    },
  );
  coordinates.push([...coordinates[0]]);
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [coordinates] },
  };
}
