import { realtimeJson } from "@/lib/apiResponse";
import { generateAlerts } from "@/lib/alerts";
import { getTrendingTokens } from "@/lib/data";
import { CACHE_TTLS } from "@/lib/freshness";
import { trackGeneratedAlerts } from "@/lib/trust/alertBacktest";

export const dynamic = "force-dynamic";

export async function GET() {
  const tokens = await getTrendingTokens();
  const alerts = generateAlerts(tokens);
  trackGeneratedAlerts(alerts, tokens);
  return realtimeJson({ refreshSeconds: CACHE_TTLS.geckoDiscoveryMs / 1000, alerts });
}
