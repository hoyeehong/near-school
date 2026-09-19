import Explorer from "@/components/Explorer";
import { getPlaces, isLiveData } from "@/lib/repository";
import { demoPlaces } from "@/data/demo";
export const dynamic = "force-dynamic";
export default async function Home() {
  let places = demoPlaces;
  let mode: "live" | "demo" | "degraded" = isLiveData() ? "live" : "demo";
  try {
    places = await getPlaces();
  } catch {
    mode = "degraded";
  }
  return (
    <Explorer
      initialPlaces={places}
      dataMode={mode}
      aiMode={process.env.AI_MODE === "live" ? "live" : "demo"}
    />
  );
}
