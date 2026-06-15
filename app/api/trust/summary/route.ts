import { realtimeJson } from "@/lib/apiResponse";
import { getCacheTelemetrySummary } from "@/lib/cacheTelemetry";
import { getDataFreshnessSummary, getProviderReliabilitySummary, getSourceDisagreementSummary } from "@/lib/db/repository";
import { ensureFreshnessService } from "@/lib/indexer/freshnessService";

export const dynamic = "force-dynamic";

export async function GET() {
  const freshnessService = await ensureFreshnessService({ intervalMs: 30_000, marketLimit: 20 });
  const freshness = getDataFreshnessSummary();
  const disagreements = getSourceDisagreementSummary(150);
  const providers = getProviderReliabilitySummary(100);
  const cache = getCacheTelemetrySummary(100);
  const providerErrors = providers.filter((provider) => provider.latestStatus === "error").length;
  const providerMissing = providers.filter((provider) => provider.latestStatus === "missing").length;
  const providerLimited = providers.filter((provider) => provider.latestStatus === "limited").length;
  const coreProviderErrors = providers.filter((provider) => isCoreProvider(provider.provider) && provider.latestStatus === "error").length;
  const coreProviderMissing = providers.filter((provider) => isCoreProvider(provider.provider) && provider.latestStatus === "missing").length;
  const coreProviderLimited = providers.filter((provider) => isCoreProvider(provider.provider) && provider.latestStatus === "limited").length;
  const failedProviders = providers
    .filter((provider) => provider.latestStatus === "error" || provider.latestStatus === "missing")
    .slice(0, 4)
    .map((provider) => ({
      provider: provider.provider,
      status: provider.latestStatus,
      lastError: provider.latestError,
      lastObservedAt: provider.lastObservedAt,
      lastSuccessAt: provider.lastSuccessAt
    }));
  const topDisagreements = disagreements.issues.slice(0, 4).map((issue) => ({
    tokenAddress: issue.tokenAddress,
    symbol: issue.symbol,
    metric: issue.metric,
    disagreementPct: issue.disagreementPct,
    sources: issue.sources.map((source) => ({
      source: source.source,
      value: source.value,
      observedAt: source.observedAt
    }))
  }));
  const staleRate = freshness.overallStaleRate ?? null;
  const disagreementRate = disagreements.disagreementRate ?? null;
  const health =
    coreProviderErrors > 0 || coreProviderMissing > 1 || (staleRate ?? 0) > 0.5 || (disagreementRate ?? 0) > 0.35
      ? "degraded"
      : coreProviderMissing > 0 || coreProviderLimited > 0 || (staleRate ?? 0) > 0.15 || (disagreementRate ?? 0) > 0.1
        ? "watch"
        : "healthy";

  return realtimeJson({
    trust: {
      health,
      staleRate,
      disagreementRate,
      cacheHitRate: cache.hitRate,
      providerErrors,
      providerMissing,
      providerLimited,
      coreProviderErrors,
      coreProviderMissing,
      coreProviderLimited,
      providersTracked: providers.length,
      comparableTokens: disagreements.comparableTokens,
      freshnessService,
      failedProviders,
      topDisagreements,
      topWarnings: [
        staleRate !== null && staleRate > 0.5 ? `${Math.round(staleRate * 100)}% of live tracked data is stale.` : "",
        disagreementRate !== null && disagreementRate > 0 ? `${disagreements.tokensWithDisagreement} comparable tokens have provider disagreements.` : "",
        providerErrors ? `${providerErrors} provider${providerErrors === 1 ? "" : "s"} currently erroring.` : "",
        providerLimited ? `${providerLimited} provider${providerLimited === 1 ? "" : "s"} currently rate-limited or credit-limited.` : "",
        providerMissing ? `${providerMissing} provider${providerMissing === 1 ? "" : "s"} missing or unconfigured.` : ""
      ].filter(Boolean),
      updatedAt: new Date().toISOString()
    }
  });
}

function isCoreProvider(provider: string) {
  return [
    "Base RPC",
    "Alchemy Base RPC",
    "Etherscan/BaseScan",
    "Blockscout Base",
    "DexScreener",
    "GeckoTerminal",
    "Bankr"
  ].includes(provider);
}
