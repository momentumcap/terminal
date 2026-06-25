import { realtimeJson } from "@/lib/apiResponse";
import { fetchBankrLaunches } from "@/lib/bankr";
import { CACHE_TTLS } from "@/lib/freshness";

export const dynamic = "force-dynamic";

export async function GET() {
  const launches = await fetchBankrLaunches();
  return realtimeJson({
    chainId: 8453,
    source: "Bankr live public API + onchain/market enrichment",
    dataPolicy: "live-only-no-silent-mock-fallback",
    refreshSeconds: CACHE_TTLS.bankrLaunchesMs / 1000,
    warnings: launches.length ? [] : ["No live Bankr launches were returned. Mock launches are intentionally hidden for accuracy."],
    launches
  });
}
