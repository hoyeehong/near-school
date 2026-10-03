// This module is imported only by the private ingestion job, never by the client.
export async function fetchUra(accessKey: string) {
  if (!accessKey) throw new Error("URA_ACCESS_KEY is not configured");
  const headers: Record<string, string> = {
    AccessKey: accessKey,
    Accept: "application/json",
    "User-Agent": "NearSchool/1.0",
  };
  async function request(path: string) {
    const response = await fetch(
      "https://eservice.ura.gov.sg/uraDataService/" + path,
      { headers, signal: AbortSignal.timeout(60000), cache: "no-store" },
    );
    if (!response.ok) throw new Error(`URA HTTP ${response.status}`);
    const body = await response.json();
    if (body.Status !== "Success") throw new Error("URA request rejected");
    return body.Result;
  }
  const token = await request("insertNewToken/v1");
  if (typeof token !== "string" || !token)
    throw new Error("URA token unavailable");
  headers.Token = token;
  const rows: Record<string, unknown>[] = [];
  for (const batch of [1, 2, 3, 4]) {
    const data = await request(
      `invokeUraDS/v1?service=PMI_Resi_Transaction&batch=${batch}`,
    );
    if (!Array.isArray(data) || !data.length)
      throw new Error("Incomplete URA snapshot");
    rows.push(...data);
  }
  return rows;
}
