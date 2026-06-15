import { realtimeJson } from "@/lib/apiResponse";
import { getSourceDisagreementSummary } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  return realtimeJson({
    disagreements: getSourceDisagreementSummary()
  });
}
