import { realtimeJson } from "@/lib/apiResponse";
import { getCacheTelemetrySummary } from "@/lib/cacheTelemetry";

export const dynamic = "force-dynamic";

export async function GET() {
  return realtimeJson({
    cache: getCacheTelemetrySummary()
  });
}
