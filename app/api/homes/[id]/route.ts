import { getHomePlace, recentTransactions } from "@/lib/housing/repository";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^(ura-|hdb-sale-)[a-f0-9]{24}$/.test(id))
    return Response.json({ error: "Invalid home." }, { status: 400 });
  try {
    const home = await getHomePlace(id);
    if (!home)
      return Response.json({ error: "Home not found." }, { status: 404 });
    return Response.json(
      { home, transactions: await recentTransactions(id) },
      { headers: { "Cache-Control": "public,max-age=300" } },
    );
  } catch {
    return Response.json(
      { error: "Transactions unavailable." },
      { status: 503 },
    );
  }
}
