import { realtimeJson } from "@/lib/apiResponse";
import { getTokenAnalysis } from "@/lib/analysis";
import { readLatestAnalysisSnapshotPostgres } from "@/lib/db/postgres";
import { readLatestAnalysisSnapshot } from "@/lib/db/repository";
import { CACHE_TTLS } from "@/lib/freshness";
import { getCached, setCached } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  try {
    const normalized = address.toLowerCase();
    const cacheKey = `analysis:${normalized}`;
    const cached = getCached<Awaited<ReturnType<typeof getTokenAnalysis>>>(cacheKey);
    if (cached && hasCriticalOnchainCoverage(cached)) return realtimeJson({ refreshSeconds: CACHE_TTLS.analysisMs / 1000, cache: "memory", analysis: cached });

    const persisted = readLatestAnalysisSnapshot(normalized, 5 * 60_000);
    if (persisted && hasCriticalOnchainCoverage(persisted)) {
      setCached(cacheKey, persisted, Math.min(CACHE_TTLS.analysisMs, 30_000));
      return realtimeJson({ refreshSeconds: CACHE_TTLS.analysisMs / 1000, cache: "sqlite", analysis: persisted });
    }

    const durable = await readLatestAnalysisSnapshotPostgres(normalized, 5 * 60_000);
    if (durable && hasCriticalOnchainCoverage(durable)) {
      setCached(cacheKey, durable, Math.min(CACHE_TTLS.analysisMs, 30_000));
      return realtimeJson({ refreshSeconds: CACHE_TTLS.analysisMs / 1000, cache: "neon", analysis: durable });
    }

    const analysis = setCached(cacheKey, await getTokenAnalysis(normalized), Math.min(CACHE_TTLS.analysisMs, 30_000));
    return realtimeJson({ refreshSeconds: CACHE_TTLS.analysisMs / 1000, cache: "fresh", analysis });
  } catch {
    return NextResponse.json(
      {
        error: "Token analysis unavailable",
        message: "No exact Base market data was found for this contract address. We will not substitute another token.",
        address
      },
      { status: 404, headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } }
    );
  }
}

function hasCriticalOnchainCoverage(analysis: Awaited<ReturnType<typeof getTokenAnalysis>>) {
  return Boolean(
    analysis.onchain?.profile &&
    analysis.onchain?.holders &&
    analysis.onchain?.contractRisk &&
    analysis.onchain?.deployer &&
    Array.isArray(analysis.onchain?.events) &&
    analysis.ownData?.transactionWindowsAvailable
  );
}
