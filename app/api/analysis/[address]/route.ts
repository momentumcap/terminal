import { realtimeJson } from "@/lib/apiResponse";
import { getTokenAnalysis, sanitizeTokenAnalysisForDisplay } from "@/lib/analysis";
import { readLatestAnalysisSnapshotPostgres } from "@/lib/db/postgres";
import { readLatestAnalysisSnapshot } from "@/lib/db/repository";
import { CACHE_TTLS } from "@/lib/freshness";
import { getCached, setCached } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type TokenAnalysisResult = Awaited<ReturnType<typeof getTokenAnalysis>>;

const HOT_SNAPSHOT_MAX_AGE_MS = 5 * 60_000;
const BACKUP_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60_000;
const activeRefreshes = new Set<string>();

export async function GET(_request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  try {
    const normalized = address.toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
      return NextResponse.json(
        {
          error: "Invalid Base token address",
          message: "Paste a full Base contract address that starts with 0x and contains 40 hexadecimal characters.",
          address
        },
        { status: 400, headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" } }
      );
    }

    const cacheKey = `analysis:${normalized}`;
    const cached = getCached<TokenAnalysisResult>(cacheKey);
    if (cached) {
      const sanitized = sanitizeTokenAnalysisForDisplay(cached);
      const complete = hasCriticalOnchainCoverage(sanitized);
      if (!complete) refreshAnalysisInBackground(cacheKey, normalized);
      return realtimeJson({
        refreshSeconds: CACHE_TTLS.analysisMs / 1000,
        cache: complete ? "memory" : "memory-partial",
        staleWhileRevalidate: !complete,
        analysis: sanitized
      });
    }

    const persisted = readLatestAnalysisSnapshot(normalized, HOT_SNAPSHOT_MAX_AGE_MS);
    if (persisted) {
      const sanitized = sanitizeTokenAnalysisForDisplay(persisted);
      const complete = hasCriticalOnchainCoverage(sanitized);
      setCached(cacheKey, sanitized, Math.min(CACHE_TTLS.analysisMs, 30_000));
      if (!complete) refreshAnalysisInBackground(cacheKey, normalized);
      return realtimeJson({
        refreshSeconds: CACHE_TTLS.analysisMs / 1000,
        cache: complete ? "sqlite" : "sqlite-partial",
        staleWhileRevalidate: !complete,
        analysis: sanitized
      });
    }

    const durable = await readLatestAnalysisSnapshotPostgres(normalized, HOT_SNAPSHOT_MAX_AGE_MS);
    if (durable) {
      const sanitized = sanitizeTokenAnalysisForDisplay(durable);
      const complete = hasCriticalOnchainCoverage(sanitized);
      setCached(cacheKey, sanitized, Math.min(CACHE_TTLS.analysisMs, 30_000));
      if (!complete) refreshAnalysisInBackground(cacheKey, normalized);
      return realtimeJson({
        refreshSeconds: CACHE_TTLS.analysisMs / 1000,
        cache: complete ? "neon" : "neon-partial",
        staleWhileRevalidate: !complete,
        analysis: sanitized
      });
    }

    const backup = readLatestAnalysisSnapshot(normalized, BACKUP_SNAPSHOT_MAX_AGE_MS) ?? await readLatestAnalysisSnapshotPostgres(normalized, BACKUP_SNAPSHOT_MAX_AGE_MS);
    if (backup) {
      const sanitized = sanitizeTokenAnalysisForDisplay(backup);
      setCached(cacheKey, sanitized, Math.min(CACHE_TTLS.analysisMs, 30_000));
      refreshAnalysisInBackground(cacheKey, normalized);
      return realtimeJson({
        refreshSeconds: CACHE_TTLS.analysisMs / 1000,
        cache: "snapshot-stale",
        staleWhileRevalidate: true,
        warnings: ["Returned the latest exact-address snapshot while live providers refresh in the background."],
        analysis: sanitized
      });
    }

    const analysis = setCached(cacheKey, sanitizeTokenAnalysisForDisplay(await getTokenAnalysis(normalized)), Math.min(CACHE_TTLS.analysisMs, 30_000));
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

function hasCriticalOnchainCoverage(analysis: TokenAnalysisResult) {
  return Boolean(
    analysis.onchain?.profile &&
    analysis.onchain?.holders &&
    analysis.onchain?.contractRisk &&
    analysis.onchain?.deployer &&
    Array.isArray(analysis.onchain?.events) &&
    analysis.ownData?.transactionWindowsAvailable
  );
}

function refreshAnalysisInBackground(cacheKey: string, normalizedAddress: string) {
  if (activeRefreshes.has(normalizedAddress)) return;
  activeRefreshes.add(normalizedAddress);
  void getTokenAnalysis(normalizedAddress)
    .then((analysis) => {
      setCached(cacheKey, sanitizeTokenAnalysisForDisplay(analysis), Math.min(CACHE_TTLS.analysisMs, 30_000));
    })
    .catch(() => {
      // Background refresh failures should be visible through data-quality warnings,
      // not by breaking the foreground API response.
    })
    .finally(() => {
      activeRefreshes.delete(normalizedAddress);
    });
}
