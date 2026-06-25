import { realtimeJson } from "@/lib/apiResponse";
import { getNewTokenFeed } from "@/lib/data";
import { CACHE_TTLS } from "@/lib/freshness";

export const dynamic = "force-dynamic";

export async function GET() {
  const feed = await getNewTokenFeed();
  return realtimeJson({
    chainId: 8453,
    source: feed.source,
    dataPolicy: feed.dataPolicy,
    refreshSeconds: CACHE_TTLS.geckoDiscoveryMs / 1000,
    warnings: feed.warnings,
    tokens: feed.tokens
  });
}
