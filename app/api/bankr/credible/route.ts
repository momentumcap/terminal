import { realtimeJson } from "@/lib/apiResponse";
import { getCredibleBankrLaunches } from "@/lib/bankr";
import { CACHE_TTLS } from "@/lib/freshness";

export const dynamic = "force-dynamic";

export async function GET() {
  const launches = await getCredibleBankrLaunches();
  return realtimeJson({
    chainId: 8453,
    source: "Bankr live public API + credibility filters",
    dataPolicy: "live-only-no-silent-mock-fallback",
    refreshSeconds: CACHE_TTLS.bankrLaunchesMs / 1000,
    criteria: "verdict verified_alpha/watch or credibilityScore >= 70",
    warnings: launches.length ? [] : ["No credible live Bankr launches currently match the configured filters."],
    launches
  });
}
