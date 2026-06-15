import { realtimeJson } from "@/lib/apiResponse";
import { getTrendingTokenFeed } from "@/lib/data";
import { CACHE_TTLS } from "@/lib/freshness";
import { startFreshnessService } from "@/lib/indexer/freshnessService";

export const dynamic = "force-dynamic";

export async function GET() {
  startFreshnessService({ intervalMs: 30_000, marketLimit: 10 });
  const feed = await getTrendingTokenFeed();
  return realtimeJson({
    chainId: 8453,
    source: feed.source,
    dataPolicy: feed.dataPolicy,
    refreshSeconds: CACHE_TTLS.geckoDiscoveryMs / 1000,
    warnings: feed.warnings,
    tokens: feed.tokens
  });
}
