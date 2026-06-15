import { realtimeJson } from "@/lib/apiResponse";
import { getTokenAnalysis } from "@/lib/analysis";
import { CACHE_TTLS } from "@/lib/freshness";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const analysis = await getTokenAnalysis(address);
  return realtimeJson({ refreshSeconds: CACHE_TTLS.analysisMs / 1000, risk: analysis.risk, deployer: analysis.deployer, manipulation: analysis.manipulation });
}
