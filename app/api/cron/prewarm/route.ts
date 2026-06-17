import { NextRequest, NextResponse } from "next/server";
import { fetchBankrLaunchFeedSnapshot } from "@/lib/bankr";
import { requireCronAccess } from "@/lib/cronAuth";
import { getIndexerCandidateTokens } from "@/lib/db/repository";
import { getNewTokens, getTrendingTokens } from "@/lib/data";
import { prewarmTokenAnalysisData, type AnalysisPrewarmResult } from "@/lib/indexer/analysisPrewarm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Candidate = { tokenAddress: string; symbol?: string | null; reason: string; priority: number };

export async function GET(request: NextRequest) {
  const denied = requireCronAccess(request);
  if (denied) return denied;

  const startedAt = new Date().toISOString();
  const limit = clamp(Number(request.nextUrl.searchParams.get("limit") ?? 6), 1, 12);
  const lookbackBlocks = clamp(Number(request.nextUrl.searchParams.get("lookbackBlocks") ?? 7_200), 600, 43_200);
  const deadlineAt = Date.now() + 50_000;
  const candidates = await collectPrewarmCandidates();
  const selected = candidates.slice(0, limit);
  const results: AnalysisPrewarmResult[] = [];
  const warnings: string[] = [];

  for (const candidate of selected) {
    if (Date.now() > deadlineAt) {
      warnings.push("Prewarm cron stopped early to stay inside the serverless time budget.");
      break;
    }
    try {
      const result = await prewarmTokenAnalysisData(candidate.tokenAddress, {
        lookbackBlocks,
        runHolderIndexer: true
      });
      results.push(result);
      warnings.push(...result.warnings.map((warning) => `${candidate.symbol ?? candidate.tokenAddress}: ${warning}`));
    } catch (error) {
      warnings.push(`${candidate.tokenAddress}: ${error instanceof Error ? error.message : "prewarm failed"}`);
    }
  }

  return NextResponse.json({
    ok: true,
    job: "analysis-prewarm",
    startedAt,
    finishedAt: new Date().toISOString(),
    requestedLimit: limit,
    candidateCount: candidates.length,
    selected,
    warmedCount: results.length,
    results,
    warnings: [...new Set(warnings)].slice(0, 40)
  });
}

async function collectPrewarmCandidates(): Promise<Candidate[]> {
  const [trending, fresh, bankr] = await Promise.all([
    getTrendingTokens().catch(() => []),
    getNewTokens().catch(() => []),
    fetchBankrLaunchFeedSnapshot().catch(() => [])
  ]);

  return dedupeCandidates([
    ...bankr.slice(0, 10).map((launch) => ({
      tokenAddress: launch.tokenAddress,
      symbol: launch.tokenSymbol,
      reason: `bankr-${launch.verdict}`,
      priority: launch.verdict === "verified_alpha" ? 120 : launch.verdict === "watch" ? 95 : 70
    })),
    ...trending.slice(0, 12).map((token) => ({
      tokenAddress: token.tokenAddress,
      symbol: token.symbol,
      reason: "trending",
      priority: 90 + Math.round(token.scores.opportunityScore / 10)
    })),
    ...fresh.slice(0, 8).map((token) => ({
      tokenAddress: token.tokenAddress,
      symbol: token.symbol,
      reason: "new-pool",
      priority: 86
    })),
    ...getIndexerCandidateTokens(10).map((token) => ({
      tokenAddress: token.tokenAddress,
      symbol: token.symbol,
      reason: token.reason ?? "tracked",
      priority: token.priority ?? 60
    }))
  ]).sort((a, b) => b.priority - a.priority);
}

function dedupeCandidates(candidates: Candidate[]) {
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const candidate of candidates) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(candidate.tokenAddress)) continue;
    const tokenAddress = candidate.tokenAddress.toLowerCase();
    if (seen.has(tokenAddress)) continue;
    seen.add(tokenAddress);
    out.push({ ...candidate, tokenAddress });
  }
  return out;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? Math.round(value) : min));
}
