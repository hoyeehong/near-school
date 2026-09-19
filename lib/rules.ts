import type { DistanceBand, OfficialDistance, Place } from "./types";
export function registrationTrack(
  school: Pick<Place, "id" | "twoTrackFrom">,
  distance: OfficialDistance | null,
  year: number,
) {
  if (!distance || distance.year !== year || distance.schoolId !== school.id)
    return {
      verified: false,
      label: "Official distance unverified",
      track: null,
    };
  const twoTrack =
    school.twoTrackFrom !== undefined && year >= school.twoTrackFrom;
  const labels: Record<DistanceBand, string> = {
    "within-1km": "Within 1 km",
    "between-1-and-2km": "Between 1 and 2 km",
    "beyond-2km": "Beyond 2 km",
  };
  return {
    verified: true,
    label: twoTrack
      ? distance.band === "beyond-2km"
        ? "Phase 2C · >2 km track"
        : "Phase 2C · ≤2 km track"
      : labels[distance.band],
    track: twoTrack
      ? distance.band === "beyond-2km"
        ? "far"
        : "near"
      : distance.band,
  };
}
/** Amenity exploration only. Never use point distance for official HSD. */
export function metresBetween(a: [number, number], b: [number, number]) {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad,
    dLon = (b[0] - a[0]) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
