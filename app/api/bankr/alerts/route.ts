import { realtimeJson } from "@/lib/apiResponse";
import { buildBankrAlerts } from "@/lib/bankrAlerts";
import { fetchBankrLaunches } from "@/lib/bankr";
import { CACHE_TTLS } from "@/lib/freshness";

export const dynamic = "force-dynamic";

export async function GET() {
  const launches = await fetchBankrLaunches();
  return realtimeJson({
    source: "Bankr live public API + alert rules",
    dataPolicy: "live-only-no-silent-mock-fallback",
    refreshSeconds: CACHE_TTLS.bankrLaunchesMs / 1000,
    warnings: launches.length ? [] : ["No live Bankr launches available for alert generation."],
    alerts: buildBankrAlerts(launches)
  });
}
