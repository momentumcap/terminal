import { realtimeJson } from "@/lib/apiResponse";
import { getAlertPerformance } from "@/lib/trust/alertBacktest";

export const dynamic = "force-dynamic";

export async function GET() {
  return realtimeJson(getAlertPerformance());
}
