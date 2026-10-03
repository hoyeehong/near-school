import { createHash } from "node:crypto";
import proj4 from "proj4";
import { URA_SOURCE, HDB_SOURCE } from "./types";
export type Project = {
  id: string;
  name: string;
  address: string;
  kind: "private" | "hdb";
  coordinates: [number, number] | null;
  sourceUrl: string;
};
export type Transaction = {
  id: string;
  projectId: string;
  month: string;
  price: number;
  area: number;
  propertyType: string;
  areaType: string;
  tenure: string;
  saleType: string;
  floorRange: string;
  units: number;
};
export const hash = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 24);
export function svy21(x: number, y: number): [number, number] {
  const p = proj4(
    "+proj=tmerc +lat_0=1.36666666666667 +lon_0=103.833333333333 +k=1 +x_0=28001.642 +y_0=38744.572 +ellps=WGS84 +units=m +no_defs",
    "EPSG:4326",
    [x, y],
  );
  if (
    !p.every(Number.isFinite) ||
    p[0] < 103 ||
    p[0] > 105 ||
    p[1] < 1 ||
    p[1] > 2
  )
    throw new Error("Invalid Singapore coordinate");
  return p as [number, number];
}
export function uraMonth(value: string) {
  if (!/^(0[1-9]|1[0-2])\d{2}$/.test(value))
    throw new Error("Invalid transaction month");
  return `20${value.slice(2)}-${value.slice(0, 2)}-01`;
}
export function normalizeUra(rows: Record<string, unknown>[]) {
  const projects: Project[] = [],
    transactions: Transaction[] = [];
  const occurrences = new Map<string, number>();
  for (const row of rows) {
    const name = String(row.project ?? "").trim(),
      address = String(row.street ?? "").trim();
    if (!name || !address || !Array.isArray(row.transaction))
      throw new Error("Invalid URA project");
    const id = "ura-" + hash([name, address, row.x, row.y]);
    const coordinates =
      row.x && row.y ? svy21(Number(row.x), Number(row.y)) : null;
    projects.push({
      id,
      name,
      address,
      kind: "private",
      coordinates,
      sourceUrl: URA_SOURCE,
    });
    const duplicates = occurrences;
    for (const raw of row.transaction as Record<string, string>[]) {
      const signature = hash([id, raw]),
        occurrence = duplicates.get(signature) ?? 0;
      duplicates.set(signature, occurrence + 1);
      const price = Number(raw.price),
        area = Number(raw.area),
        units = Number(raw.noOfUnits);
      if (
        !Number.isFinite(price) ||
        price <= 0 ||
        !Number.isFinite(area) ||
        area <= 0 ||
        !Number.isInteger(units) ||
        units < 1
      )
        throw new Error("Invalid URA transaction");
      const saleType = (
        { "1": "new", "2": "subsale", "3": "resale" } as Record<string, string>
      )[raw.typeOfSale];
      if (!saleType) throw new Error("Unknown sale type");
      transactions.push({
        id: hash([id, signature, occurrence]),
        projectId: id,
        month: uraMonth(raw.contractDate),
        price,
        area,
        units,
        propertyType: raw.propertyType,
        areaType: raw.typeOfArea,
        tenure: raw.tenure,
        saleType,
        floorRange: raw.floorRange ?? "",
      });
    }
  }
  return {
    projects: [...new Map(projects.map((p) => [p.id, p])).values()],
    transactions,
  };
}
export function normalizeHdb(rows: Record<string, string>[]) {
  const projects = new Map<string, Project>(),
    transactions: Transaction[] = [],
    duplicates = new Map<string, number>();
  for (const row of rows) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month))
      throw new Error("Invalid HDB month");
    const address = `${row.block} ${row.street_name}`,
      id = "hdb-sale-" + hash(address);
    projects.set(id, {
      id,
      name: address,
      address,
      kind: "hdb",
      coordinates: null,
      sourceUrl: HDB_SOURCE,
    });
    const signature = hash(row),
      occurrence = duplicates.get(signature) ?? 0;
    duplicates.set(signature, occurrence + 1);
    const price = Number(row.resale_price),
      area = Number(row.floor_area_sqm);
    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isFinite(area) ||
      area <= 0
    )
      throw new Error("Invalid HDB transaction");
    transactions.push({
      id: hash([id, signature, occurrence]),
      projectId: id,
      month: row.month + "-01",
      price,
      area,
      propertyType: row.flat_type,
      areaType: "Strata",
      tenure: `99 years from ${row.lease_commence_date}`,
      saleType: "resale",
      floorRange: row.storey_range,
      units: 1,
    });
  }
  return { projects: [...projects.values()], transactions };
}
