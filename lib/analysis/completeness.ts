import type { AnalysisDataCoverage, AnalysisDataPoint, AnalysisDataPointStatus, TokenAnalysis } from "@/lib/analysis/types";

type AnalysisLike = Omit<TokenAnalysis, "tacticalSummary" | "liveEvents" | "dataCoverage"> & Partial<Pick<TokenAnalysis, "tacticalSummary" | "liveEvents">>;

export function buildAnalysisDataCoverage(analysis: AnalysisLike): AnalysisDataCoverage {
  const points: AnalysisDataPoint[] = [
    point({
      key: "market.price",
      label: "Price",
      group: "Market",
      ok: analysis.trustedMetrics?.price?.value !== null && analysis.trustedMetrics?.price?.value !== undefined,
      source: analysis.trustedMetrics?.price?.source ?? analysis.marketData.primaryMarketSource,
      confidence: analysis.trustedMetrics?.price?.confidence ?? "medium",
      value: formatValue(analysis.trustedMetrics?.price?.value, "usd"),
      lastUpdated: analysis.trustedMetrics?.price?.lastUpdated,
      warnings: analysis.trustedMetrics?.price?.warnings
    }),
    point({
      key: "market.liquidity",
      label: "Liquidity",
      group: "Liquidity",
      ok: analysis.liquidity.liquidityUsd > 0,
      source: analysis.trustedMetrics?.liquidity?.source ?? analysis.marketData.primaryMarketSource,
      confidence: analysis.trustedMetrics?.liquidity?.confidence ?? "medium",
      value: formatValue(analysis.liquidity.liquidityUsd, "usd"),
      lastUpdated: analysis.trustedMetrics?.liquidity?.lastUpdated,
      warnings: analysis.trustedMetrics?.liquidity?.warnings
    }),
    point({
      key: "market.volume24h",
      label: "24h volume",
      group: "Market",
      ok: analysis.trustedMetrics?.volume24h?.value !== null && analysis.trustedMetrics?.volume24h?.value !== undefined,
      source: analysis.trustedMetrics?.volume24h?.source ?? analysis.marketData.primaryMarketSource,
      confidence: analysis.trustedMetrics?.volume24h?.confidence ?? "medium",
      value: formatValue(analysis.trustedMetrics?.volume24h?.value, "usd"),
      lastUpdated: analysis.trustedMetrics?.volume24h?.lastUpdated,
      warnings: analysis.trustedMetrics?.volume24h?.warnings
    }),
    point({
      key: "flow.providerWindows",
      label: "Provider buy/sell windows",
      group: "Flow",
      ok: analysis.momentum.providerTransactionWindows.some((window) => window.total !== null),
      partial: analysis.momentum.providerTransactionWindows.some((window) => window.source === "Unavailable"),
      source: providerWindowSources(analysis),
      confidence: analysis.momentum.providerTransactionWindows.some((window) => window.total !== null) ? "medium" : "low",
      value: windowSummary(analysis.momentum.providerTransactionWindows),
      warnings: analysis.momentum.providerTransactionWindows.some((window) => window.source === "Unavailable") ? ["Some provider transaction windows are unavailable."] : []
    }),
    point({
      key: "flow.baseRpcWindows",
      label: "Base RPC swap windows",
      group: "Flow",
      ok: Boolean(analysis.ownData?.transactionWindowsAvailable || analysis.momentum.onchainTransactionWindows.length),
      partial: analysis.momentum.onchainTransactionWindows.some((window) => !window.complete),
      source: "BaseRPC",
      confidence: analysis.momentum.onchainTransactionWindows.some((window) => window.complete) ? "high" : analysis.ownData?.transactionWindowsAvailable ? "medium" : "low",
      value: windowSummary(analysis.momentum.onchainTransactionWindows),
      lastUpdated: analysis.ownData?.updatedAt,
      warnings: analysis.momentum.onchainTransactionWindows.some((window) => !window.complete) ? ["Base RPC returned one or more partial swap windows. Zero-swap windows are still shown as observed when the block range was scanned."] : []
    }),
    point({
      key: "onchain.metadata",
      label: "Onchain metadata",
      group: "System",
      ok: Boolean(analysis.onchain?.profile?.symbol || analysis.ownData?.tokenMetadata.symbol),
      partial: Boolean(analysis.onchain?.profile?.dataQuality.isPartial),
      source: analysis.onchain?.profile?.dataQuality.source ?? analysis.ownData?.source ?? "BaseRPC",
      confidence: analysis.onchain?.profile?.dataQuality.confidence ?? "medium",
      value: analysis.onchain?.profile?.symbol ?? analysis.ownData?.tokenMetadata.symbol ?? "missing",
      lastUpdated: analysis.onchain?.profile?.dataQuality.fetchedAt ?? analysis.ownData?.updatedAt,
      warnings: analysis.onchain?.profile?.dataQuality.warnings
    }),
    point({
      key: "holders.count",
      label: "Holder count",
      group: "Holders",
      ok: analysis.holders.holderCount !== null || Boolean(analysis.holders.walletIntelligence?.indexedWalletCount),
      partial: analysis.holders.holderCount === null || analysis.holders.holderCountIsEstimate || analysis.holders.confidence === "low",
      source: analysis.holders.source ?? analysis.onchain?.holders?.dataQuality.source ?? (analysis.holders.walletIntelligence?.indexedWalletCount ? "local-holder-indexer" : "holder adapter"),
      confidence: analysis.holders.confidence ?? analysis.onchain?.holders?.dataQuality.confidence ?? "low",
      value: analysis.holders.holderCount === null ? (analysis.holders.walletIntelligence?.indexedWalletCount ? `>=${analysis.holders.walletIntelligence.indexedWalletCount.toLocaleString()} observed` : "missing") : analysis.holders.holderCount.toLocaleString(),
      lastUpdated: analysis.onchain?.holders?.dataQuality.fetchedAt,
      warnings: analysis.holders.holderCount === null && analysis.holders.walletIntelligence?.indexedWalletCount ? [
        "Exact holder count is unavailable from configured providers; local observed wallet count is a lower-bound, not total holders.",
        ...(analysis.holders.warnings ?? [])
      ] : analysis.holders.warnings
    }),
    point({
      key: "holders.distribution",
      label: "Holder distribution",
      group: "Holders",
      ok: Boolean(analysis.holders.topHolders?.length || analysis.holders.walletIntelligence?.largestObservedWallets.length),
      partial: (analysis.holders.sampledHolderCount ?? analysis.holders.walletIntelligence?.largestObservedWallets.length ?? 0) < 25,
      source: analysis.holders.source ?? analysis.onchain?.holders?.dataQuality.source ?? (analysis.holders.walletIntelligence?.largestObservedWallets.length ? "local-holder-indexer" : "holder adapter"),
      confidence: analysis.holders.confidence ?? "low",
      value: `${analysis.holders.sampledHolderCount ?? analysis.holders.topHolders?.length ?? analysis.holders.walletIntelligence?.largestObservedWallets.length ?? 0} sampled`,
      lastUpdated: analysis.onchain?.holders?.dataQuality.fetchedAt,
      warnings: analysis.onchain?.holders?.dataQuality.warnings ?? analysis.holders.walletIntelligence?.warnings
    }),
    point({
      key: "risk.contract",
      label: "Contract risk",
      group: "Risk",
      ok: Boolean(analysis.onchain?.contractRisk),
      partial: Boolean(analysis.onchain?.contractRisk?.dataQuality.isPartial),
      source: analysis.onchain?.contractRisk?.dataQuality.source ?? "risk adapter",
      confidence: analysis.onchain?.contractRisk?.dataQuality.confidence ?? "low",
      value: analysis.risk.status,
      lastUpdated: analysis.onchain?.contractRisk?.dataQuality.fetchedAt,
      warnings: analysis.onchain?.contractRisk?.dataQuality.warnings ?? ["Contract risk adapter did not return verified data."]
    }),
    point({
      key: "risk.deployer",
      label: "Deployer profile",
      group: "Risk",
      ok: Boolean(analysis.onchain?.deployer),
      partial: Boolean(analysis.onchain?.deployer?.dataQuality.isPartial),
      source: analysis.onchain?.deployer?.dataQuality.source ?? "deployer adapter",
      confidence: analysis.onchain?.deployer?.dataQuality.confidence ?? "low",
      value: analysis.onchain?.deployer?.deployer ?? "missing",
      lastUpdated: analysis.onchain?.deployer?.dataQuality.fetchedAt,
      warnings: analysis.onchain?.deployer?.dataQuality.warnings ?? ["Deployer wallet was not resolved."]
    }),
    point({
      key: "events.recent",
      label: "Recent onchain events",
      group: "System",
      ok: Array.isArray(analysis.onchain?.events),
      partial: !analysis.onchain?.events?.length,
      source: "BaseRPC/Blockscout",
      confidence: analysis.onchain?.events?.length ? "medium" : "low",
      value: `${analysis.onchain?.events?.length ?? 0} events`,
      warnings: analysis.onchain?.events?.length ? ["Live events are best-effort until a dedicated indexer is running."] : ["Provider check completed; no recent token events were observed in this refresh."]
    }),
    point({
      key: "wallets.intelligence",
      label: "Wallet intelligence",
      group: "Wallets",
      ok: analysis.smartMoney.onchainWalletsAvailable || analysis.smartMoney.wallets.length > 0,
      partial: analysis.smartMoney.wallets.length > 0 && !analysis.smartMoney.onchainWalletsAvailable,
      source: analysis.smartMoney.wallets[0]?.dataSource ?? "wallet adapter",
      confidence: analysis.smartMoney.wallets[0]?.dataConfidence ?? "low",
      value: `${analysis.smartMoney.wallets.length} wallets`,
      warnings: analysis.smartMoney.walletSignals.length ? analysis.smartMoney.walletSignals : ["No verified wallet profiles available."]
    }),
    point({
      key: "social.momentum",
      label: "Social momentum",
      group: "Social",
      ok: Boolean(analysis.narrative.socialMomentum),
      partial: analysis.narrative.socialMomentum?.dataQuality.confidence !== "high",
      source: analysis.narrative.socialMomentum?.dataQuality.source ?? "social adapter",
      confidence: analysis.narrative.socialMomentum?.dataQuality.confidence ?? "low",
      value: analysis.narrative.socialMomentum?.trendLabel ?? "missing",
      lastUpdated: analysis.narrative.socialMomentum?.dataQuality.fetchedAt,
      warnings: analysis.narrative.socialMomentum?.dataQuality.warnings ?? ["Live social source unavailable or not configured."]
    }),
    point({
      key: "tradeability.simulation",
      label: "Tradeability simulations",
      group: "Tradeability",
      ok: analysis.tradeability.simulations.length >= 4,
      partial: analysis.tradeability.simulations.some((simulation) => simulation.verdict === "avoid"),
      source: "liquidity model",
      confidence: analysis.liquidity.liquidityUsd > 0 ? "medium" : "low",
      value: `${analysis.tradeability.simulations.length} sizes`,
      warnings: analysis.liquidity.liquidityUsd > 0 ? ["Model uses liquidity depth approximation, not a live sell simulation."] : ["Liquidity unavailable, tradeability model is low confidence."]
    })
  ];

  const confirmed = points.filter((item) => item.status === "confirmed").length;
  const partial = points.filter((item) => item.status === "partial").length;
  const missing = points.filter((item) => item.status === "missing").length;
  const blockers = points
    .filter((item) => item.status === "missing")
    .map((item) => item.label);

  return {
    updatedAt: new Date().toISOString(),
    complete: missing === 0 && blockers.length === 0,
    confirmed,
    partial,
    missing,
    score: Math.round((confirmed * 100 + partial * 55) / Math.max(points.length, 1)),
    blockers,
    points
  };
}

function point(input: {
  key: string;
  label: string;
  group: AnalysisDataPoint["group"];
  ok?: boolean;
  partial?: boolean;
  source: string;
  confidence: "high" | "medium" | "low";
  value: string;
  lastUpdated?: string;
  warnings?: string[];
}): AnalysisDataPoint {
  const status: AnalysisDataPointStatus = input.ok ? input.partial ? "partial" : "confirmed" : "missing";
  return {
    key: input.key,
    label: input.label,
    group: input.group,
    status,
    source: input.source,
    confidence: status === "missing" ? "low" : input.confidence,
    value: input.value,
    lastUpdated: input.lastUpdated,
    warnings: input.warnings?.filter(Boolean) ?? []
  };
}

function providerWindowSources(analysis: AnalysisLike) {
  return Array.from(new Set(analysis.momentum.providerTransactionWindows.map((window) => window.source).filter((source) => source !== "Unavailable"))).join(" + ") || "provider raw fields";
}

function windowSummary(windows: Array<{ window: string; total: number | null; source?: string }>) {
  if (!windows.length) return "missing";
  return windows.map((window) => `${window.window}:${window.total ?? "N/A"}`).join(" ");
}

function formatValue(value: unknown, kind: "usd") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "missing";
  if (kind === "usd") {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toPrecision(4)}`;
  }
  return String(value);
}
