import { realtimeJson } from "@/lib/apiResponse";
import { getProviderReliabilitySummary } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  return realtimeJson({
    providers: getProviderReliabilitySummary(100)
  });
}
