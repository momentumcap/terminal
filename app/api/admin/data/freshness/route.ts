import { realtimeJson } from "@/lib/apiResponse";
import { getDataFreshnessSummary } from "@/lib/db/repository";
import { ensureFreshnessService } from "@/lib/indexer/freshnessService";

export const dynamic = "force-dynamic";

export async function GET() {
  const freshnessService = await ensureFreshnessService({ intervalMs: 30_000, marketLimit: 20 });
  return realtimeJson({
    freshness: getDataFreshnessSummary(),
    freshnessService
  });
}
