import { NextRequest, NextResponse } from "next/server";
import { requireCronAccess } from "@/lib/cronAuth";
import { runFreshnessWarmup } from "@/lib/indexer/freshnessService";
import { sampleTrackedTokenMarkets } from "@/lib/indexer/marketSampler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const denied = requireCronAccess(request);
  if (denied) return denied;

  const startedAt = new Date().toISOString();
  const [freshness, marketSample] = await Promise.all([
    runFreshnessWarmup({ marketLimit: 20 }),
    sampleTrackedTokenMarkets({ limit: 12 })
  ]);

  return NextResponse.json({
    ok: true,
    job: "freshness",
    startedAt,
    finishedAt: new Date().toISOString(),
    freshness,
    marketSample
  });
}
