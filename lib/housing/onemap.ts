export async function locateAddress(
  address: string,
  postal?: string,
): Promise<[number, number] | null> {
  if (!process.env.ONEMAP_TOKEN) return null;
  const r = await fetch(
    "https://www.onemap.gov.sg/api/common/elastic/search?" +
      new URLSearchParams({
        searchVal: postal || address,
        returnGeom: "Y",
        getAddrDetails: "Y",
        pageNum: "1",
      }),
    {
      headers: {
        Authorization: process.env.ONEMAP_TOKEN,
        "User-Agent": "NearSchool/1.0",
      },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!r.ok) throw new Error("OneMap address lookup unavailable");
  const data = await r.json();
  const canonical = (s: string) =>
    s
      .toUpperCase()
      .replace(
        /\b(AVE|RD|ST|DR|TER|CRES|JLN|BT|UPP|LOR|CTRL|HTS)\b/g,
        (x) =>
          ({
            AVE: "AVENUE",
            RD: "ROAD",
            ST: "STREET",
            DR: "DRIVE",
            TER: "TERRACE",
            CRES: "CRESCENT",
            JLN: "JALAN",
            BT: "BUKIT",
            UPP: "UPPER",
            LOR: "LORONG",
            CTRL: "CENTRAL",
            HTS: "HEIGHTS",
          })[x]!,
      )
      .replace(/[^A-Z0-9]/g, "");
  const found = (data.results ?? []).filter(
    (x: Record<string, string>) =>
      /^\d{6}$/.test(x.POSTAL ?? "") &&
      (postal
        ? x.POSTAL === postal
        : canonical(`${x.BLK_NO} ${x.ROAD_NAME}`) === canonical(address)),
  );
  if (found.length !== 1) return null;
  const p: [number, number] = [
    Number(found[0].LONGITUDE),
    Number(found[0].LATITUDE),
  ];
  return p.every(Number.isFinite) &&
    p[0] > 103 &&
    p[0] < 105 &&
    p[1] > 1 &&
    p[1] < 2
    ? p
    : null;
}
