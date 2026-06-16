import type { BankrLaunch } from "@/types/bankr";
import type { TokenAnalysis } from "@/lib/analysis/types";
import type { HolderDistribution, TokenTransfer } from "@/lib/onchain/types";
import type { ProviderHealth, TrustedMetric } from "@/lib/trust/types";
import { STALE_THRESHOLDS_MS } from "@/lib/trust/staleness";
import type { TokenSnapshot } from "@/lib/types";
import { getDatabase, getDatabasePath } from "@/lib/db/sqlite";

type PersistResult = { ok: true } | { ok: false; error: string };

const ACTIVE_FRESHNESS_WINDOWS_MS = {
  market: 5 * 60_000,
  analysis: 5 * 60_000,
  holders: 45 * 60_000,
  alerts: 10 * 60_000,
  providers: 10 * 60_000,
  bankr: 5 * 60_000
};
const SOURCE_DISAGREEMENT_ACTIVE_WINDOW_MS = 5 * 60_000;
const SOURCE_DISAGREEMENT_MAX_SKEW_MS = 2 * 60_000;

export interface HolderIndexerRunInput {
  tokenAddress: string;
  fromBlock: number;
  toBlock: number;
  transferCount: number;
  walletCount: number;
  status: "ok" | "partial" | "error";
  warnings: string[];
  startedAt: string;
  finishedAt: string;
}

export type OnchainComponentName = "profile" | "holders" | "risk" | "deployer" | "events" | "ownData";

export interface OnchainComponentSnapshot<T = unknown> {
  tokenAddress: string;
  component: OnchainComponentName;
  observedAt: string;
  confidence: "high" | "medium" | "low" | null;
  dataQuality: unknown;
  payload: T;
}

export interface HolderIntelligenceSummary {
  tokenAddress: string;
  indexedTransferCount: number;
  indexedWalletCount: number;
  activeWalletsRecent: number;
  netAccumulatorWallets: number;
  netDistributorWallets: number;
  largestObservedWallets: Array<{
    address: string;
    firstSeenBlock: number;
    lastSeenBlock: number;
    inCount: number;
    outCount: number;
    netRaw: string;
    direction: "accumulating" | "distributing" | "flat";
  }>;
  lastRun: {
    fromBlock: number;
    toBlock: number;
    transferCount: number;
    walletCount: number;
    status: string;
    warnings: string[];
    startedAt: string;
    finishedAt: string;
  } | null;
  warnings: string[];
}

export interface IndexerCandidateToken {
  tokenAddress: string;
  symbol: string | null;
  name: string | null;
  lastObservedAt: string;
  marketSnapshots: number;
  indexedTransfers: number;
  reason?: string;
  priority?: number;
}

export interface TrackedIndexerToken {
  tokenAddress: string;
  symbol?: string | null;
  name?: string | null;
  reason: string;
  priority: number;
  enabled: boolean;
  lastIndexedAt?: string | null;
  updatedAt: string;
}

export interface WalletIntelligenceEvent {
  id: string;
  tokenAddress: string;
  type: "transfer_activity" | "accumulation_pressure" | "distribution_pressure" | "indexer_partial" | "wallet_memory_built";
  severity: "info" | "alpha" | "warning" | "danger";
  message: string;
  metrics: Record<string, number | string | boolean | null>;
  createdAt: string;
}

export interface WalletEventPerformance {
  eventId: string;
  tokenAddress: string;
  eventType: string;
  firedAt: string;
  priceAtFire: number | null;
  liquidityAtFire: number | null;
  volumeAtFire: number | null;
  priceAfter5m: number | null;
  priceAfter1h: number | null;
  priceAfter24h: number | null;
  maxDrawdownAfter1h: number | null;
  maxUpsideAfter1h: number | null;
  outcome: "good" | "neutral" | "bad" | "unknown";
  updatedAt: string;
}

export interface ProviderReliabilitySummary {
  provider: string;
  totalChecks: number;
  okChecks: number;
  errorChecks: number;
  missingChecks: number;
  limitedChecks: number;
  uptimePct: number | null;
  averageLatencyMs: number | null;
  latestStatus: ProviderHealth["status"];
  latestBlock: number | null;
  latestError: string | null;
  lastObservedAt: string | null;
  lastSuccessAt: string | null;
}

export interface DataFreshnessBucket {
  label: string;
  table: string;
  totalEntities: number;
  freshEntities: number;
  staleEntities: number;
  staleRate: number | null;
  thresholdMs: number;
  latestObservedAt: string | null;
  oldestObservedAt: string | null;
  warning: string | null;
}

export interface DataFreshnessSummary {
  overallStaleRate: number | null;
  totalEntities: number;
  staleEntities: number;
  buckets: DataFreshnessBucket[];
  fetchedAt: string;
}

export interface SourceDisagreementIssue {
  tokenAddress: string;
  symbol: string | null;
  metric: "price" | "liquidity" | "marketCap" | "volume24h";
  disagreementPct: number;
  thresholdPct: number;
  sources: Array<{ source: string; value: number; observedAt: string }>;
}

export interface SourceDisagreementSummary {
  comparableTokens: number;
  tokensWithDisagreement: number;
  disagreementRate: number | null;
  metricCounts: Record<SourceDisagreementIssue["metric"], number>;
  issues: SourceDisagreementIssue[];
  fetchedAt: string;
}

type MarketSnapshotDisagreementRow = {
  token_address: string;
  symbol: string | null;
  pair_address: string | null;
  source: string | null;
  observed_at: string;
  price_usd: number | null;
  liquidity_usd: number | null;
  market_cap: number | null;
  volume_24h: number | null;
};

export type BetaFeedbackCategory = "bad_data" | "missing_data" | "wrong_risk" | "ui_bug" | "performance" | "feature_request" | "other";
export type BetaFeedbackSeverity = "low" | "medium" | "high" | "critical";

export interface BetaFeedbackReportInput {
  category: BetaFeedbackCategory;
  severity: BetaFeedbackSeverity;
  tokenAddress?: string | null;
  pageUrl?: string | null;
  title: string;
  details: string;
  expectedResult?: string | null;
  stepsToReproduce?: string | null;
  contact?: string | null;
  userAgent?: string | null;
  context?: Record<string, unknown>;
}

export interface BetaFeedbackReport extends BetaFeedbackReportInput {
  id: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  createdAt: string;
}

export interface BetaFeedbackSummary {
  total: number;
  open: number;
  reviewing: number;
  resolved: number;
  dismissed: number;
  critical: number;
  high: number;
  dataAccuracy: number;
  latestAt: string | null;
  categoryCounts: Array<{ category: BetaFeedbackCategory; count: number }>;
  severityCounts: Array<{ severity: BetaFeedbackSeverity; count: number }>;
  recent: BetaFeedbackReport[];
}

const json = (value: unknown) => JSON.stringify(value ?? null);
const bool = (value: boolean) => value ? 1 : 0;
const now = () => new Date().toISOString();

export function persistTokenSnapshots(tokens: TokenSnapshot[], context: string): PersistResult {
  return safely(() => {
    const db = getDatabase();
    const upsertToken = db.prepare(`
      insert into tokens (chain_id, token_address, symbol, name, first_seen_at, updated_at)
      values (?, ?, ?, ?, ?, ?)
      on conflict(token_address) do update set
        symbol = excluded.symbol,
        name = excluded.name,
        updated_at = excluded.updated_at
    `);
    const insertSnapshot = db.prepare(`
      insert into token_market_snapshots (
        chain_id, token_address, symbol, name, pair_address, dex_id, context, observed_at,
        price_usd, market_cap, fdv, liquidity_usd,
        volume_5m, volume_1h, volume_6h, volume_24h,
        buys_5m, sells_5m, buys_1h, sells_1h, buys_6h, sells_6h, buys_24h, sells_24h,
        source, sources_json, confidence, payload_json
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    withTransaction(() => {
      for (const token of tokens) {
        const address = token.tokenAddress.toLowerCase();
        const observedAt = token.updatedAt || now();
        upsertToken.run(token.chainId, address, token.symbol, token.name, observedAt, observedAt);
        insertSnapshot.run(
          token.chainId,
          address,
          token.symbol,
          token.name,
          token.pairAddress?.toLowerCase() ?? null,
          token.dexId ?? null,
          context,
          observedAt,
          token.priceUsd,
          token.marketCap,
          token.fdv,
          token.liquidityUsd,
          token.volume5m,
          token.volume1h,
          token.volume6h,
          token.volume24h,
          token.txns5mBuys,
          token.txns5mSells,
          token.txns1hBuys,
          token.txns1hSells,
          token.txns6hBuys,
          token.txns6hSells,
          token.txns24hBuys,
          token.txns24hSells,
          token.primaryMarketSource ?? "unknown",
          json(token.marketDataSources ?? [token.primaryMarketSource ?? "unknown"]),
          "medium",
          json(token)
        );
      }
    });
  });
}

export function listRecentTokenSnapshots(contexts: string[], maxAgeMs: number, limit = 50): TokenSnapshot[] {
  if (!contexts.length) return [];
  const db = getDatabase();
  const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
  const placeholders = contexts.map(() => "?").join(", ");
  const rows = db.prepare(`
    select token_address, observed_at, payload_json
    from token_market_snapshots
    where context in (${placeholders}) and observed_at >= ?
    order by observed_at desc
    limit ?
  `).all(...contexts, cutoff, Math.max(limit * 6, limit)) as Array<{
    token_address: string;
    observed_at: string;
    payload_json: string;
  }>;
  const byToken = new Map<string, TokenSnapshot>();
  for (const row of rows) {
    if (byToken.size >= limit) break;
    const payload = safeParseObject(row.payload_json);
    const tokenAddress = String(payload.tokenAddress ?? row.token_address ?? "").toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(tokenAddress) || byToken.has(tokenAddress)) continue;
    byToken.set(tokenAddress, {
      chainId: Number(payload.chainId ?? 8453),
      tokenAddress,
      symbol: String(payload.symbol ?? "UNKNOWN"),
      name: String(payload.name ?? payload.symbol ?? "Unknown Token"),
      priceUsd: nullableNumber(payload.priceUsd),
      fdv: nullableNumber(payload.fdv),
      marketCap: nullableNumber(payload.marketCap),
      liquidityUsd: nullableNumber(payload.liquidityUsd),
      volume5m: nullableNumber(payload.volume5m),
      volume1h: nullableNumber(payload.volume1h),
      volume6h: nullableNumber(payload.volume6h),
      volume24h: nullableNumber(payload.volume24h),
      priceChange5m: nullableNumber(payload.priceChange5m),
      priceChange1h: nullableNumber(payload.priceChange1h),
      priceChange6h: nullableNumber(payload.priceChange6h),
      priceChange24h: nullableNumber(payload.priceChange24h),
      txns5mBuys: nullableNumber(payload.txns5mBuys),
      txns5mSells: nullableNumber(payload.txns5mSells),
      txns1hBuys: nullableNumber(payload.txns1hBuys),
      txns1hSells: nullableNumber(payload.txns1hSells),
      txns6hBuys: nullableNumber(payload.txns6hBuys),
      txns6hSells: nullableNumber(payload.txns6hSells),
      txns24hBuys: nullableNumber(payload.txns24hBuys),
      txns24hSells: nullableNumber(payload.txns24hSells),
      pairAddress: String(payload.pairAddress ?? ""),
      dexId: String(payload.dexId ?? "unknown"),
      pairCreatedAt: nullableNumber(payload.pairCreatedAt),
      url: String(payload.url ?? ""),
      updatedAt: row.observed_at,
      primaryMarketSource: payload.primaryMarketSource === "DexScreener" || payload.primaryMarketSource === "GeckoTerminal" ? payload.primaryMarketSource : "DexScreener",
      marketDataSources: Array.isArray(payload.marketDataSources) ? payload.marketDataSources as TokenSnapshot["marketDataSources"] : ["DexScreener"]
    });
  }
  return [...byToken.values()];
}

export function persistTrustedMetrics(entityType: string, entityId: string, metrics: Record<string, TrustedMetric<unknown>> | undefined): PersistResult {
  if (!metrics) return { ok: true };
  return safely(() => {
    const db = getDatabase();
    const stmt = db.prepare(`
      insert into trusted_metric_observations (
        entity_type, entity_id, metric_key, label, value_json, source, sources_tried_json,
        confidence, is_estimated, is_stale, missing_fields_json, warnings_json, observed_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    withTransaction(() => {
      for (const [key, metric] of Object.entries(metrics)) {
        stmt.run(
          entityType,
          entityId.toLowerCase(),
          key,
          metric.label,
          json(metric.value),
          metric.source,
          json(metric.sourcesTried),
          metric.confidence,
          bool(metric.isEstimated),
          bool(metric.isStale),
          json(metric.missingFields),
          json(metric.warnings),
          metric.lastUpdated || now()
        );
      }
    });
  });
}

export function persistAnalysisSnapshot(analysis: TokenAnalysis): PersistResult {
  return safely(() => {
    const db = getDatabase();
    const stmt = db.prepare(`
      insert into analysis_snapshots (
        chain_id, token_address, symbol, name, observed_at,
        data_quality_json, trusted_scores_json, trusted_metrics_json, payload_json
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      analysis.chainId,
      analysis.address.toLowerCase(),
      analysis.symbol,
      analysis.name,
      analysis.updatedAt || now(),
      json(analysis.dataQuality),
      json(analysis.trustedScores),
      json(analysis.trustedMetrics),
      json(analysis)
    );
    upsertTrackedIndexerToken({
      tokenAddress: analysis.address,
      symbol: analysis.symbol,
      name: analysis.name,
      reason: "analysis",
      priority: 90
    });
    persistTrustedMetrics("analysis", analysis.address, analysis.trustedMetrics);
  });
}

export function readLatestAnalysisSnapshot(tokenAddress: string, maxAgeMs = 5 * 60_000): TokenAnalysis | null {
  const row = getDatabase().prepare(`
    select payload_json, observed_at
    from analysis_snapshots
    where token_address = ?
    order by observed_at desc
    limit 1
  `).get(tokenAddress.toLowerCase()) as { payload_json: string; observed_at: string } | undefined;
  if (!row) return null;
  const observedMs = new Date(row.observed_at).getTime();
  if (!Number.isFinite(observedMs) || Date.now() - observedMs > maxAgeMs) return null;
  try {
    return JSON.parse(row.payload_json) as TokenAnalysis;
  } catch {
    return null;
  }
}

export function persistHolderSnapshot(distribution: HolderDistribution): PersistResult {
  return safely(() => {
    const db = getDatabase();
    const stmt = db.prepare(`
      insert into holder_snapshots (
        token_address, observed_at, total_holders, sampled_holder_count,
        top10_pct, top25_pct, top50_pct, concentration_risk,
        source, confidence, data_quality_json, holders_json
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      distribution.tokenAddress.toLowerCase(),
      distribution.dataQuality.fetchedAt || now(),
      distribution.totalHolders ?? null,
      distribution.sampledHolderCount ?? distribution.holders.length,
      distribution.top10Pct ?? null,
      distribution.top25Pct ?? null,
      distribution.top50Pct ?? null,
      distribution.concentrationRisk,
      distribution.dataQuality.source,
      distribution.dataQuality.confidence,
      json(distribution.dataQuality),
      json(distribution.holders)
    );
  });
}

export function persistOnchainComponentSnapshot<T>(input: {
  tokenAddress: string;
  component: OnchainComponentName;
  payload: T | null | undefined;
  dataQuality?: unknown;
  confidence?: "high" | "medium" | "low" | null;
  observedAt?: string;
}): PersistResult {
  if (input.payload === undefined || input.payload === null) return { ok: true };
  return safely(() => {
    getDatabase().prepare(`
      insert into onchain_component_snapshots (
        token_address, component, observed_at, confidence, data_quality_json, payload_json
      ) values (?, ?, ?, ?, ?, ?)
    `).run(
      input.tokenAddress.toLowerCase(),
      input.component,
      input.observedAt ?? now(),
      input.confidence ?? null,
      json(input.dataQuality ?? null),
      json(input.payload)
    );
  });
}

export function readLatestOnchainComponentSnapshot<T>(tokenAddress: string, component: OnchainComponentName, maxAgeMs = 24 * 60 * 60_000): OnchainComponentSnapshot<T> | null {
  const row = getDatabase().prepare(`
    select token_address, component, observed_at, confidence, data_quality_json, payload_json
    from onchain_component_snapshots
    where token_address = ? and component = ?
    order by observed_at desc
    limit 1
  `).get(tokenAddress.toLowerCase(), component) as {
    token_address: string;
    component: OnchainComponentName;
    observed_at: string;
    confidence: "high" | "medium" | "low" | null;
    data_quality_json: string;
    payload_json: string;
  } | undefined;
  if (!row) return null;
  const observedMs = new Date(row.observed_at).getTime();
  if (!Number.isFinite(observedMs) || Date.now() - observedMs > maxAgeMs) return null;
  try {
    return {
      tokenAddress: row.token_address,
      component: row.component,
      observedAt: row.observed_at,
      confidence: row.confidence,
      dataQuality: JSON.parse(row.data_quality_json),
      payload: JSON.parse(row.payload_json) as T
    };
  } catch {
    return null;
  }
}

export function persistBankrLaunches(launches: BankrLaunch[]): PersistResult {
  return safely(() => {
    const db = getDatabase();
    const stmt = db.prepare(`
      insert into bankr_launches (
        token_address, chain_id, token_name, token_symbol, creator_handle, launched_at, last_seen_at,
        credibility_score, launch_quality_score, risk_score, opportunity_score, verdict,
        data_quality_json, payload_json
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(token_address) do update set
        token_name = excluded.token_name,
        token_symbol = excluded.token_symbol,
        creator_handle = excluded.creator_handle,
        last_seen_at = excluded.last_seen_at,
        credibility_score = excluded.credibility_score,
        launch_quality_score = excluded.launch_quality_score,
        risk_score = excluded.risk_score,
        opportunity_score = excluded.opportunity_score,
        verdict = excluded.verdict,
        data_quality_json = excluded.data_quality_json,
        payload_json = excluded.payload_json
    `);
    withTransaction(() => {
      for (const launch of launches) {
        stmt.run(
          launch.tokenAddress.toLowerCase(),
          launch.chainId,
          launch.tokenName,
          launch.tokenSymbol,
          launch.creatorHandle ?? null,
          launch.launchedAt,
          now(),
          launch.credibilityScore,
          launch.launchQualityScore,
          launch.riskScore,
          launch.opportunityScore,
          launch.verdict ?? null,
          json(launch.dataQuality),
          json(launch)
        );
      }
    });
  });
}

export function persistProviderHealth(providers: ProviderHealth[]): PersistResult {
  return safely(() => {
    const db = getDatabase();
    const stmt = db.prepare(`
      insert into provider_observations (
        provider, status, latency_ms, latest_block, configured, last_error, observed_at, payload_json
      ) values (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    withTransaction(() => {
      for (const provider of providers) {
        stmt.run(
          provider.provider,
          provider.status,
          provider.latencyMs ?? null,
          provider.latestBlock ?? null,
          bool(provider.configured),
          provider.lastError ?? null,
          provider.lastSuccessAt ?? now(),
          json(provider)
        );
      }
    });
  });
}

export function getProviderReliabilitySummary(limitPerProvider = 100): ProviderReliabilitySummary[] {
  const db = getDatabase();
  const providers = db.prepare(`
    select distinct provider
    from provider_observations
    order by provider asc
  `).all() as Array<{ provider: string }>;

  return providers.map(({ provider }) => {
    const rows = db.prepare(`
      select provider, status, latency_ms, latest_block, last_error, observed_at
      from provider_observations
      where provider = ?
      order by observed_at desc
      limit ?
    `).all(provider, Math.max(1, Math.min(limitPerProvider, 500))) as Array<{
      provider: string;
      status: ProviderHealth["status"];
      latency_ms: number | null;
      latest_block: number | null;
      last_error: string | null;
      observed_at: string;
    }>;
    const latest = rows[0];
    const okChecks = rows.filter((row) => row.status === "ok").length;
    const errorChecks = rows.filter((row) => row.status === "error").length;
    const missingChecks = rows.filter((row) => row.status === "missing").length;
    const limitedChecks = rows.filter((row) => row.status === "limited").length;
    const latencyValues = rows.map((row) => row.latency_ms).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const lastSuccess = rows.find((row) => row.status === "ok");
    return {
      provider,
      totalChecks: rows.length,
      okChecks,
      errorChecks,
      missingChecks,
      limitedChecks,
      uptimePct: rows.length ? okChecks / rows.length : null,
      averageLatencyMs: latencyValues.length ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length) : null,
      latestStatus: latest?.status ?? "missing",
      latestBlock: latest?.latest_block ?? null,
      latestError: latest?.last_error ?? null,
      lastObservedAt: latest?.observed_at ?? null,
      lastSuccessAt: lastSuccess?.observed_at ?? null
    };
  });
}

export function getDataFreshnessSummary(referenceTime = new Date()): DataFreshnessSummary {
  const buckets = [
    buildFreshnessBucket("Market Data", "token_market_snapshots", "token_address", "observed_at", STALE_THRESHOLDS_MS.market, ACTIVE_FRESHNESS_WINDOWS_MS.market),
    buildFreshnessBucket("Analysis Snapshots", "analysis_snapshots", "token_address", "observed_at", STALE_THRESHOLDS_MS.market, ACTIVE_FRESHNESS_WINDOWS_MS.analysis),
    buildFreshnessBucket("Holder Snapshots", "holder_snapshots", "token_address", "observed_at", STALE_THRESHOLDS_MS.holders, ACTIVE_FRESHNESS_WINDOWS_MS.holders),
    buildFreshnessBucket("Provider Checks", "provider_observations", "provider", "observed_at", STALE_THRESHOLDS_MS.alerts, ACTIVE_FRESHNESS_WINDOWS_MS.providers),
    buildFreshnessBucket("Wallet Events", "wallet_intelligence_events", "token_address", "created_at", STALE_THRESHOLDS_MS.alerts, ACTIVE_FRESHNESS_WINDOWS_MS.alerts),
    buildFreshnessBucket("Bankr Launches", "bankr_launches", "token_address", "last_seen_at", STALE_THRESHOLDS_MS.alerts, ACTIVE_FRESHNESS_WINDOWS_MS.bankr)
  ].map((bucket) => scoreFreshnessBucket(bucket, referenceTime));
  const totals = buckets.reduce((acc, bucket) => ({
    total: acc.total + bucket.totalEntities,
    stale: acc.stale + bucket.staleEntities
  }), { total: 0, stale: 0 });
  return {
    overallStaleRate: totals.total ? totals.stale / totals.total : null,
    totalEntities: totals.total,
    staleEntities: totals.stale,
    buckets,
    fetchedAt: referenceTime.toISOString()
  };
}

export function getSourceDisagreementSummary(limitTokens = 150): SourceDisagreementSummary {
  const db = getDatabase();
  const referenceMs = Date.now();
  const tokenRows = db.prepare(`
    select token_address
    from token_market_snapshots
    group by token_address
    order by max(observed_at) desc
    limit ?
  `).all(Math.max(1, Math.min(limitTokens, 500))) as Array<{ token_address: string }>;

  const latestRows = db.prepare(`
    select token_address, symbol, pair_address, source, observed_at, price_usd, liquidity_usd, market_cap, volume_24h
    from token_market_snapshots
    where token_address = ?
    order by observed_at desc
    limit 200
  `);
  const issues: SourceDisagreementIssue[] = [];
  let comparableTokens = 0;
  let tokensWithDisagreement = 0;

  for (const token of tokenRows) {
    const rows = latestRows.all(token.token_address) as MarketSnapshotDisagreementRow[];
    const activeRows = rows.filter((row) => {
      const observedMs = new Date(row.observed_at).getTime();
      return Number.isFinite(observedMs) && referenceMs - observedMs <= SOURCE_DISAGREEMENT_ACTIVE_WINDOW_MS;
    });
    const pairGroups = new Map<string, typeof activeRows>();
    for (const row of activeRows) {
      const pair = row.pair_address?.toLowerCase();
      if (!pair) continue;
      pairGroups.set(pair, [...(pairGroups.get(pair) ?? []), row]);
    }
    let latestBySource = new Map<string, MarketSnapshotDisagreementRow>();
    let bestObservedAt = 0;
    for (const groupRows of pairGroups.values()) {
      const bySource = new Map<string, MarketSnapshotDisagreementRow>();
      for (const row of groupRows) {
        const source = row.source || "unknown";
        if (!bySource.has(source)) bySource.set(source, row);
      }
      const newestInGroup = Math.max(...groupRows.map((row) => new Date(row.observed_at).getTime()).filter(Number.isFinite));
      if (bySource.size > latestBySource.size || (bySource.size === latestBySource.size && newestInGroup > bestObservedAt)) {
        latestBySource = bySource;
        bestObservedAt = newestInGroup;
      }
    }
    if (latestBySource.size < 2) continue;
    comparableTokens += 1;
    const tokenIssues = [
      buildDisagreementIssue(token.token_address, rows[0]?.symbol ?? null, "price", "price_usd", 3, latestBySource),
      buildDisagreementIssue(token.token_address, rows[0]?.symbol ?? null, "liquidity", "liquidity_usd", 10, latestBySource),
      buildDisagreementIssue(token.token_address, rows[0]?.symbol ?? null, "marketCap", "market_cap", 10, latestBySource),
      buildDisagreementIssue(token.token_address, rows[0]?.symbol ?? null, "volume24h", "volume_24h", 15, latestBySource)
    ].filter((issue): issue is SourceDisagreementIssue => Boolean(issue));
    if (tokenIssues.length) {
      tokensWithDisagreement += 1;
      issues.push(...tokenIssues);
    }
  }

  const metricCounts = issues.reduce<Record<SourceDisagreementIssue["metric"], number>>((counts, issue) => {
    counts[issue.metric] += 1;
    return counts;
  }, { price: 0, liquidity: 0, marketCap: 0, volume24h: 0 });

  return {
    comparableTokens,
    tokensWithDisagreement,
    disagreementRate: comparableTokens ? tokensWithDisagreement / comparableTokens : null,
    metricCounts,
    issues: issues.sort((a, b) => b.disagreementPct - a.disagreementPct).slice(0, 25),
    fetchedAt: now()
  };
}

export function persistTokenTransferObservations(tokenAddress: string, transfers: TokenTransfer[], observedAt = now()): PersistResult {
  return safely(() => {
    const db = getDatabase();
    const stmt = db.prepare(`
      insert or ignore into token_transfer_observations (
        token_address, tx_hash, log_index, block_number, from_address, to_address, value_raw, observed_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const normalized = tokenAddress.toLowerCase();
    withTransaction(() => {
      for (const transfer of transfers) {
        stmt.run(
          normalized,
          transfer.txHash.toLowerCase(),
          transfer.logIndex ?? 0,
          transfer.blockNumber,
          transfer.from.toLowerCase(),
          transfer.to.toLowerCase(),
          transfer.valueRaw,
          observedAt
        );
      }
    });
  });
}

export function upsertWalletTokenObservations(tokenAddress: string, transfers: TokenTransfer[], observedAt = now()): PersistResult {
  return safely(() => {
    const db = getDatabase();
    const existing = db.prepare(`
      select wallet_address, first_seen_block, last_seen_block, in_count, out_count, received_raw, sent_raw, net_raw
      from wallet_token_observations
      where token_address = ?
    `).all(tokenAddress.toLowerCase()) as Array<{
      wallet_address: string;
      first_seen_block: number;
      last_seen_block: number;
      in_count: number;
      out_count: number;
      received_raw: string;
      sent_raw: string;
      net_raw: string;
    }>;
    const wallets = new Map(existing.map((row) => [row.wallet_address, {
      walletAddress: row.wallet_address,
      firstSeenBlock: row.first_seen_block,
      lastSeenBlock: row.last_seen_block,
      inCount: row.in_count,
      outCount: row.out_count,
      receivedRaw: BigInt(row.received_raw),
      sentRaw: BigInt(row.sent_raw),
      netRaw: BigInt(row.net_raw)
    }]));
    const zeroAddress = /^0x0{40}$/;
    for (const transfer of transfers) {
      if (!zeroAddress.test(transfer.to)) {
        const wallet = getWalletAccumulator(wallets, transfer.to.toLowerCase(), transfer.blockNumber);
        wallet.inCount += 1;
        wallet.receivedRaw += BigInt(transfer.valueRaw);
        wallet.netRaw += BigInt(transfer.valueRaw);
        wallet.lastSeenBlock = Math.max(wallet.lastSeenBlock, transfer.blockNumber);
        wallet.firstSeenBlock = Math.min(wallet.firstSeenBlock, transfer.blockNumber);
      }
      if (!zeroAddress.test(transfer.from)) {
        const wallet = getWalletAccumulator(wallets, transfer.from.toLowerCase(), transfer.blockNumber);
        wallet.outCount += 1;
        wallet.sentRaw += BigInt(transfer.valueRaw);
        wallet.netRaw -= BigInt(transfer.valueRaw);
        wallet.lastSeenBlock = Math.max(wallet.lastSeenBlock, transfer.blockNumber);
        wallet.firstSeenBlock = Math.min(wallet.firstSeenBlock, transfer.blockNumber);
      }
    }
    const stmt = db.prepare(`
      insert into wallet_token_observations (
        token_address, wallet_address, first_seen_block, last_seen_block,
        in_count, out_count, received_raw, sent_raw, net_raw, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(token_address, wallet_address) do update set
        first_seen_block = excluded.first_seen_block,
        last_seen_block = excluded.last_seen_block,
        in_count = excluded.in_count,
        out_count = excluded.out_count,
        received_raw = excluded.received_raw,
        sent_raw = excluded.sent_raw,
        net_raw = excluded.net_raw,
        updated_at = excluded.updated_at
    `);
    withTransaction(() => {
      for (const wallet of wallets.values()) {
        stmt.run(
          tokenAddress.toLowerCase(),
          wallet.walletAddress,
          wallet.firstSeenBlock,
          wallet.lastSeenBlock,
          wallet.inCount,
          wallet.outCount,
          wallet.receivedRaw.toString(),
          wallet.sentRaw.toString(),
          wallet.netRaw.toString(),
          observedAt
        );
      }
    });
  });
}

export function persistHolderIndexerRun(run: HolderIndexerRunInput): PersistResult {
  return safely(() => {
    const db = getDatabase();
    db.prepare(`
      insert into holder_indexer_runs (
        token_address, from_block, to_block, transfer_count, wallet_count,
        status, warnings_json, started_at, finished_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      run.tokenAddress.toLowerCase(),
      run.fromBlock,
      run.toBlock,
      run.transferCount,
      run.walletCount,
      run.status,
      json(run.warnings),
      run.startedAt,
      run.finishedAt
    );
    markTrackedTokenIndexed(run.tokenAddress, run.finishedAt);
  });
}

export function upsertTrackedIndexerToken(input: { tokenAddress: string; symbol?: string | null; name?: string | null; reason: string; priority?: number; enabled?: boolean }): PersistResult {
  return safely(() => {
    const timestamp = now();
    getDatabase().prepare(`
      insert into tracked_indexer_tokens (
        token_address, symbol, name, reason, priority, enabled, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(token_address) do update set
        symbol = coalesce(excluded.symbol, tracked_indexer_tokens.symbol),
        name = coalesce(excluded.name, tracked_indexer_tokens.name),
        reason = excluded.reason,
        priority = max(tracked_indexer_tokens.priority, excluded.priority),
        enabled = excluded.enabled,
        updated_at = excluded.updated_at
    `).run(
      input.tokenAddress.toLowerCase(),
      input.symbol ?? null,
      input.name ?? null,
      input.reason,
      input.priority ?? 50,
      bool(input.enabled ?? true),
      timestamp,
      timestamp
    );
  });
}

export function markTrackedTokenIndexed(tokenAddress: string, indexedAt = now()): PersistResult {
  return safely(() => {
    getDatabase().prepare(`
      update tracked_indexer_tokens
      set last_indexed_at = ?, updated_at = ?
      where token_address = ?
    `).run(indexedAt, indexedAt, tokenAddress.toLowerCase());
  });
}

export function getTrackedIndexerTokens(limit = 10): TrackedIndexerToken[] {
  const rows = getDatabase().prepare(`
    select token_address, symbol, name, reason, priority, enabled, last_indexed_at, updated_at
    from tracked_indexer_tokens
    where enabled = 1
    order by
      case when last_indexed_at is null then 0 else 1 end asc,
      priority desc,
      last_indexed_at asc
    limit ?
  `).all(Math.max(1, Math.min(limit, 50))) as Array<{
    token_address: string;
    symbol: string | null;
    name: string | null;
    reason: string;
    priority: number;
    enabled: number;
    last_indexed_at: string | null;
    updated_at: string;
  }>;
  return rows.map((row) => ({
    tokenAddress: row.token_address,
    symbol: row.symbol,
    name: row.name,
    reason: row.reason,
    priority: row.priority,
    enabled: Boolean(row.enabled),
    lastIndexedAt: row.last_indexed_at,
    updatedAt: row.updated_at
  }));
}

export function persistWalletIntelligenceEvents(events: WalletIntelligenceEvent[]): PersistResult {
  if (!events.length) return { ok: true };
  return safely(() => {
    const stmt = getDatabase().prepare(`
      insert or ignore into wallet_intelligence_events (
        id, token_address, type, severity, message, metrics_json, created_at
      ) values (?, ?, ?, ?, ?, ?, ?)
    `);
    withTransaction(() => {
      for (const event of events) {
        stmt.run(
          event.id,
          event.tokenAddress.toLowerCase(),
          event.type,
          event.severity,
          event.message,
          json(event.metrics),
          event.createdAt
        );
      }
    });
    seedWalletEventPerformance(events);
  });
}

export function seedWalletEventPerformance(events: WalletIntelligenceEvent[]): PersistResult {
  if (!events.length) return { ok: true };
  return safely(() => {
    const db = getDatabase();
    const stmt = db.prepare(`
      insert or ignore into wallet_event_performance (
        event_id, token_address, event_type, fired_at, price_at_fire,
        liquidity_at_fire, volume_at_fire, outcome, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, 'unknown', ?)
    `);
    withTransaction(() => {
      for (const event of events) {
        const market = findNearestMarketSnapshot(event.tokenAddress, event.createdAt, "before");
        stmt.run(
          event.id,
          event.tokenAddress.toLowerCase(),
          event.type,
          event.createdAt,
          market?.price_usd ?? null,
          market?.liquidity_usd ?? null,
          market?.volume_24h ?? null,
          now()
        );
      }
    });
  });
}

export function refreshWalletEventPerformance(limit = 100): WalletEventPerformance[] {
  const db = getDatabase();
  const rows = db.prepare(`
    select event_id, token_address, event_type, fired_at, price_at_fire
    from wallet_event_performance
    where outcome = 'unknown'
    order by fired_at asc
    limit ?
  `).all(Math.max(1, Math.min(limit, 500))) as Array<{ event_id: string; token_address: string; event_type: string; fired_at: string; price_at_fire: number | null }>;
  const update = db.prepare(`
    update wallet_event_performance
    set price_after_5m = ?, price_after_1h = ?, price_after_24h = ?,
      max_drawdown_after_1h = ?, max_upside_after_1h = ?, outcome = ?, updated_at = ?
    where event_id = ?
  `);
  withTransaction(() => {
    for (const row of rows) {
      const firedMs = new Date(row.fired_at).getTime();
      const five = findNearestMarketSnapshot(row.token_address, new Date(firedMs + 5 * 60_000).toISOString(), "after");
      const hour = findNearestMarketSnapshot(row.token_address, new Date(firedMs + 60 * 60_000).toISOString(), "after");
      const day = findNearestMarketSnapshot(row.token_address, new Date(firedMs + 24 * 60 * 60_000).toISOString(), "after");
      const oneHourPrices = getMarketPricesBetween(row.token_address, row.fired_at, new Date(firedMs + 60 * 60_000).toISOString());
      const basePrice = row.price_at_fire ?? null;
      const minPrice = oneHourPrices.length ? Math.min(...oneHourPrices) : null;
      const maxPrice = oneHourPrices.length ? Math.max(...oneHourPrices) : null;
      const drawdown = basePrice && minPrice ? (minPrice - basePrice) / basePrice : null;
      const upside = basePrice && maxPrice ? (maxPrice - basePrice) / basePrice : null;
      const outcome = classifyWalletEventOutcome(row.event_type, basePrice, hour?.price_usd ?? null, upside, drawdown);
      update.run(five?.price_usd ?? null, hour?.price_usd ?? null, day?.price_usd ?? null, drawdown, upside, outcome, now(), row.event_id);
    }
  });
  return listWalletEventPerformance(limit);
}

export function listWalletEventPerformance(limit = 50): WalletEventPerformance[] {
  const rows = getDatabase().prepare(`
    select event_id, token_address, event_type, fired_at, price_at_fire, liquidity_at_fire,
      volume_at_fire, price_after_5m, price_after_1h, price_after_24h,
      max_drawdown_after_1h, max_upside_after_1h, outcome, updated_at
    from wallet_event_performance
    order by fired_at desc
    limit ?
  `).all(Math.max(1, Math.min(limit, 200))) as Array<{
    event_id: string;
    token_address: string;
    event_type: string;
    fired_at: string;
    price_at_fire: number | null;
    liquidity_at_fire: number | null;
    volume_at_fire: number | null;
    price_after_5m: number | null;
    price_after_1h: number | null;
    price_after_24h: number | null;
    max_drawdown_after_1h: number | null;
    max_upside_after_1h: number | null;
    outcome: WalletEventPerformance["outcome"];
    updated_at: string;
  }>;
  return rows.map((row) => ({
    eventId: row.event_id,
    tokenAddress: row.token_address,
    eventType: row.event_type,
    firedAt: row.fired_at,
    priceAtFire: row.price_at_fire,
    liquidityAtFire: row.liquidity_at_fire,
    volumeAtFire: row.volume_at_fire,
    priceAfter5m: row.price_after_5m,
    priceAfter1h: row.price_after_1h,
    priceAfter24h: row.price_after_24h,
    maxDrawdownAfter1h: row.max_drawdown_after_1h,
    maxUpsideAfter1h: row.max_upside_after_1h,
    outcome: row.outcome,
    updatedAt: row.updated_at
  }));
}

export function getWalletEventPerformanceSummary() {
  const items = listWalletEventPerformance(500);
  const known = items.filter((item) => item.outcome !== "unknown");
  const byType = new Map<string, WalletEventPerformance[]>();
  for (const item of items) byType.set(item.eventType, [...(byType.get(item.eventType) ?? []), item]);
  return {
    totalEventsTracked: items.length,
    knownOutcomes: known.length,
    unknownOutcomes: items.length - known.length,
    goodRate: known.length ? known.filter((item) => item.outcome === "good").length / known.length : null,
    badRate: known.length ? known.filter((item) => item.outcome === "bad").length / known.length : null,
    averageReturnAfter1h: avg(items.map((item) => item.priceAtFire && item.priceAfter1h ? (item.priceAfter1h - item.priceAtFire) / item.priceAtFire : null).filter((item): item is number => item !== null)),
    byType: [...byType.entries()].map(([eventType, typeItems]) => {
      const typeKnown = typeItems.filter((item) => item.outcome !== "unknown");
      return {
        eventType,
        count: typeItems.length,
        knownOutcomes: typeKnown.length,
        goodRate: typeKnown.length ? typeKnown.filter((item) => item.outcome === "good").length / typeKnown.length : null,
        badRate: typeKnown.length ? typeKnown.filter((item) => item.outcome === "bad").length / typeKnown.length : null
      };
    })
  };
}

export function listWalletIntelligenceEvents(limit = 25, tokenAddress?: string): WalletIntelligenceEvent[] {
  const db = getDatabase();
  const capped = Math.max(1, Math.min(limit, 100));
  const rows = tokenAddress
    ? db.prepare(`
      select id, token_address, type, severity, message, metrics_json, created_at
      from wallet_intelligence_events
      where token_address = ?
      order by created_at desc
      limit ?
    `).all(tokenAddress.toLowerCase(), capped)
    : db.prepare(`
      select id, token_address, type, severity, message, metrics_json, created_at
      from wallet_intelligence_events
      order by created_at desc
      limit ?
    `).all(capped);
  return (rows as Array<{ id: string; token_address: string; type: WalletIntelligenceEvent["type"]; severity: WalletIntelligenceEvent["severity"]; message: string; metrics_json: string; created_at: string }>).map((row) => ({
    id: row.id,
    tokenAddress: row.token_address,
    type: row.type,
    severity: row.severity,
    message: row.message,
    metrics: parseJsonRecord(row.metrics_json),
    createdAt: row.created_at
  }));
}

export function getHolderIntelligenceSummary(tokenAddress: string): HolderIntelligenceSummary {
  const db = getDatabase();
  const normalized = tokenAddress.toLowerCase();
  const indexedTransferCount = Number((db.prepare("select count(*) as count from token_transfer_observations where token_address = ?").get(normalized) as { count?: number } | undefined)?.count ?? 0);
  const indexedWalletCount = Number((db.prepare("select count(*) as count from wallet_token_observations where token_address = ?").get(normalized) as { count?: number } | undefined)?.count ?? 0);
  const maxBlock = Number((db.prepare("select max(block_number) as block from token_transfer_observations where token_address = ?").get(normalized) as { block?: number } | undefined)?.block ?? 0);
  const recentFloor = Math.max(0, maxBlock - 3_600);
  const activeWalletsRecent = maxBlock
    ? Number((db.prepare("select count(*) as count from wallet_token_observations where token_address = ? and last_seen_block >= ?").get(normalized, recentFloor) as { count?: number } | undefined)?.count ?? 0)
    : 0;
  const netAccumulatorWallets = Number((db.prepare("select count(*) as count from wallet_token_observations where token_address = ? and net_raw != '0' and net_raw not like '-%'").get(normalized) as { count?: number } | undefined)?.count ?? 0);
  const netDistributorWallets = Number((db.prepare("select count(*) as count from wallet_token_observations where token_address = ? and net_raw like '-%'").get(normalized) as { count?: number } | undefined)?.count ?? 0);
  const rows = db.prepare(`
    select wallet_address, first_seen_block, last_seen_block, in_count, out_count, net_raw
    from wallet_token_observations
    where token_address = ?
    order by length(replace(net_raw, '-', '')) desc, replace(net_raw, '-', '') desc
    limit 12
  `).all(normalized) as Array<{ wallet_address: string; first_seen_block: number; last_seen_block: number; in_count: number; out_count: number; net_raw: string }>;
  const run = db.prepare(`
    select from_block, to_block, transfer_count, wallet_count, status, warnings_json, started_at, finished_at
    from holder_indexer_runs
    where token_address = ?
    order by finished_at desc
    limit 1
  `).get(normalized) as { from_block: number; to_block: number; transfer_count: number; wallet_count: number; status: string; warnings_json: string; started_at: string; finished_at: string } | undefined;

  const warnings = [
    indexedTransferCount ? "" : "No locally indexed transfer history yet. Run the holder indexer for this token.",
    "Local wallet intelligence is reconstructed from observed Transfer logs and may be incomplete for older periods."
  ].filter(Boolean);

  return {
    tokenAddress: normalized,
    indexedTransferCount,
    indexedWalletCount,
    activeWalletsRecent,
    netAccumulatorWallets,
    netDistributorWallets,
    largestObservedWallets: rows.map((row) => ({
      address: row.wallet_address,
      firstSeenBlock: row.first_seen_block,
      lastSeenBlock: row.last_seen_block,
      inCount: row.in_count,
      outCount: row.out_count,
      netRaw: row.net_raw,
      direction: BigInt(row.net_raw) > BigInt(0) ? "accumulating" : BigInt(row.net_raw) < BigInt(0) ? "distributing" : "flat"
    })),
    lastRun: run ? {
      fromBlock: run.from_block,
      toBlock: run.to_block,
      transferCount: run.transfer_count,
      walletCount: run.wallet_count,
      status: run.status,
      warnings: parseJsonArray(run.warnings_json),
      startedAt: run.started_at,
      finishedAt: run.finished_at
    } : null,
    warnings
  };
}

export function getIndexerCandidateTokens(limit = 5): IndexerCandidateToken[] {
  const db = getDatabase();
  const tracked = getTrackedIndexerTokens(limit);
  if (tracked.length) {
    return tracked.map((token) => {
      const stats = db.prepare(`
        select
          count(ms.id) as market_snapshots,
          max(ms.observed_at) as last_observed_at,
          (
            select count(*)
            from token_transfer_observations tto
            where tto.token_address = ?
          ) as indexed_transfers
        from token_market_snapshots ms
        where ms.token_address = ?
      `).get(token.tokenAddress, token.tokenAddress) as { market_snapshots?: number; last_observed_at?: string; indexed_transfers?: number } | undefined;
      return {
        tokenAddress: token.tokenAddress,
        symbol: token.symbol ?? null,
        name: token.name ?? null,
        lastObservedAt: stats?.last_observed_at ?? token.updatedAt,
        marketSnapshots: Number(stats?.market_snapshots ?? 0),
        indexedTransfers: Number(stats?.indexed_transfers ?? 0),
        reason: token.reason,
        priority: token.priority
      };
    });
  }
  const rows = db.prepare(`
    select
      t.token_address,
      t.symbol,
      t.name,
      max(ms.observed_at) as last_observed_at,
      count(ms.id) as market_snapshots,
      (
        select count(*)
        from token_transfer_observations tto
        where tto.token_address = t.token_address
      ) as indexed_transfers
    from tokens t
    left join token_market_snapshots ms on ms.token_address = t.token_address
    group by t.token_address, t.symbol, t.name
    order by
      indexed_transfers asc,
      case when last_observed_at is null then 0 else 1 end asc,
      last_observed_at asc,
      market_snapshots asc
    limit ?
  `).all(Math.max(1, Math.min(limit, 25))) as Array<{
    token_address: string;
    symbol: string | null;
    name: string | null;
    last_observed_at: string;
    market_snapshots: number;
    indexed_transfers: number;
  }>;
  return rows.map((row) => ({
    tokenAddress: row.token_address,
    symbol: row.symbol,
    name: row.name,
    lastObservedAt: row.last_observed_at,
    marketSnapshots: Number(row.market_snapshots ?? 0),
    indexedTransfers: Number(row.indexed_transfers ?? 0),
    reason: "recent-observation"
  }));
}

export function getDataLayerHealth() {
  const db = getDatabase();
  const scalar = (sql: string) => Number((db.prepare(sql).get() as { count?: number } | undefined)?.count ?? 0);
  const latest = (sql: string) => (db.prepare(sql).get() as { observed_at?: string; last_seen_at?: string } | undefined);
  return {
    mode: "sqlite",
    path: getDatabasePath(),
    tables: {
      tokens: scalar("select count(*) as count from tokens"),
      marketSnapshots: scalar("select count(*) as count from token_market_snapshots"),
      trustedMetrics: scalar("select count(*) as count from trusted_metric_observations"),
      analysisSnapshots: scalar("select count(*) as count from analysis_snapshots"),
      holderSnapshots: scalar("select count(*) as count from holder_snapshots"),
      transferObservations: scalar("select count(*) as count from token_transfer_observations"),
      walletObservations: scalar("select count(*) as count from wallet_token_observations"),
      indexerRuns: scalar("select count(*) as count from holder_indexer_runs"),
      trackedIndexerTokens: scalar("select count(*) as count from tracked_indexer_tokens where enabled = 1"),
      walletIntelligenceEvents: scalar("select count(*) as count from wallet_intelligence_events"),
      walletEventPerformance: scalar("select count(*) as count from wallet_event_performance"),
      alertBacktestRecords: scalar("select count(*) as count from alert_backtest_records"),
      bankrLaunches: scalar("select count(*) as count from bankr_launches"),
      providerObservations: scalar("select count(*) as count from provider_observations"),
      cacheTelemetryEvents: scalar("select count(*) as count from cache_telemetry_events"),
      betaFeedbackReports: scalar("select count(*) as count from beta_feedback_reports")
    },
    latest: {
      market: latest("select observed_at from token_market_snapshots order by observed_at desc limit 1")?.observed_at ?? null,
      analysis: latest("select observed_at from analysis_snapshots order by observed_at desc limit 1")?.observed_at ?? null,
      holders: latest("select observed_at from holder_snapshots order by observed_at desc limit 1")?.observed_at ?? null,
      transfers: latest("select observed_at from token_transfer_observations order by observed_at desc limit 1")?.observed_at ?? null,
      indexer: latest("select finished_at as observed_at from holder_indexer_runs order by finished_at desc limit 1")?.observed_at ?? null,
      walletEvents: latest("select created_at as observed_at from wallet_intelligence_events order by created_at desc limit 1")?.observed_at ?? null,
      walletPerformance: latest("select updated_at as observed_at from wallet_event_performance order by updated_at desc limit 1")?.observed_at ?? null,
      alertBacktests: latest("select updated_at as observed_at from alert_backtest_records order by updated_at desc limit 1")?.observed_at ?? null,
      bankr: latest("select last_seen_at from bankr_launches order by last_seen_at desc limit 1")?.last_seen_at ?? null,
      providers: latest("select observed_at from provider_observations order by observed_at desc limit 1")?.observed_at ?? null,
      cacheTelemetry: latest("select observed_at from cache_telemetry_events order by observed_at desc limit 1")?.observed_at ?? null,
      betaFeedback: latest("select created_at as observed_at from beta_feedback_reports order by created_at desc limit 1")?.observed_at ?? null
    }
  };
}

export function createBetaFeedbackReport(input: BetaFeedbackReportInput): BetaFeedbackReport {
  const report: BetaFeedbackReport = {
    id: `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    category: input.category,
    severity: input.severity,
    tokenAddress: input.tokenAddress?.toLowerCase() ?? null,
    pageUrl: input.pageUrl ?? null,
    title: input.title.trim(),
    details: input.details.trim(),
    expectedResult: input.expectedResult?.trim() || null,
    stepsToReproduce: input.stepsToReproduce?.trim() || null,
    contact: input.contact?.trim() || null,
    userAgent: input.userAgent ?? null,
    context: input.context ?? {},
    status: "open",
    createdAt: now()
  };
  const db = getDatabase();
  db.prepare(`
    insert into beta_feedback_reports (
      id, category, severity, token_address, page_url, title, details, expected_result,
      steps_to_reproduce, contact, status, user_agent, context_json, created_at
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    report.id,
    report.category,
    report.severity,
    report.tokenAddress ?? null,
    report.pageUrl ?? null,
    report.title,
    report.details,
    report.expectedResult ?? null,
    report.stepsToReproduce ?? null,
    report.contact ?? null,
    report.status,
    report.userAgent ?? null,
    json(report.context),
    report.createdAt
  );
  return report;
}

export function listBetaFeedbackReports(limit = 50): BetaFeedbackReport[] {
  const db = getDatabase();
  const rows = db.prepare(`
    select *
    from beta_feedback_reports
    order by created_at desc
    limit ?
  `).all(Math.max(1, Math.min(limit, 200))) as Array<{
    id: string;
    category: BetaFeedbackCategory;
    severity: BetaFeedbackSeverity;
    token_address: string | null;
    page_url: string | null;
    title: string;
    details: string;
    expected_result: string | null;
    steps_to_reproduce: string | null;
    contact: string | null;
    status: BetaFeedbackReport["status"];
    user_agent: string | null;
    context_json: string;
    created_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    category: row.category,
    severity: row.severity,
    tokenAddress: row.token_address,
    pageUrl: row.page_url,
    title: row.title,
    details: row.details,
    expectedResult: row.expected_result,
    stepsToReproduce: row.steps_to_reproduce,
    contact: row.contact,
    userAgent: row.user_agent,
    context: safeParseObject(row.context_json),
    status: row.status,
    createdAt: row.created_at
  }));
}

export function getBetaFeedbackSummary(limit = 25): BetaFeedbackSummary {
  const db = getDatabase();
  const scalar = (sql: string) => Number((db.prepare(sql).get() as { count?: number } | undefined)?.count ?? 0);
  const latest = db.prepare("select created_at from beta_feedback_reports order by created_at desc limit 1").get() as { created_at?: string } | undefined;
  const categoryRows = db.prepare(`
    select category, count(*) as count
    from beta_feedback_reports
    group by category
    order by count desc, category asc
  `).all() as Array<{ category: BetaFeedbackCategory; count: number }>;
  const severityRows = db.prepare(`
    select severity, count(*) as count
    from beta_feedback_reports
    group by severity
    order by
      case severity
        when 'critical' then 0
        when 'high' then 1
        when 'medium' then 2
        else 3
      end
  `).all() as Array<{ severity: BetaFeedbackSeverity; count: number }>;

  return {
    total: scalar("select count(*) as count from beta_feedback_reports"),
    open: scalar("select count(*) as count from beta_feedback_reports where status = 'open'"),
    reviewing: scalar("select count(*) as count from beta_feedback_reports where status = 'reviewing'"),
    resolved: scalar("select count(*) as count from beta_feedback_reports where status = 'resolved'"),
    dismissed: scalar("select count(*) as count from beta_feedback_reports where status = 'dismissed'"),
    critical: scalar("select count(*) as count from beta_feedback_reports where severity = 'critical'"),
    high: scalar("select count(*) as count from beta_feedback_reports where severity = 'high'"),
    dataAccuracy: scalar("select count(*) as count from beta_feedback_reports where category in ('bad_data', 'missing_data', 'wrong_risk')"),
    latestAt: latest?.created_at ?? null,
    categoryCounts: categoryRows.map((row) => ({ category: row.category, count: Number(row.count ?? 0) })),
    severityCounts: severityRows.map((row) => ({ severity: row.severity, count: Number(row.count ?? 0) })),
    recent: listBetaFeedbackReports(limit)
  };
}

function getWalletAccumulator(wallets: Map<string, { walletAddress: string; firstSeenBlock: number; lastSeenBlock: number; inCount: number; outCount: number; receivedRaw: bigint; sentRaw: bigint; netRaw: bigint }>, address: string, blockNumber: number) {
  const existing = wallets.get(address);
  if (existing) return existing;
  const wallet = {
    walletAddress: address,
    firstSeenBlock: blockNumber,
    lastSeenBlock: blockNumber,
    inCount: 0,
    outCount: 0,
    receivedRaw: BigInt(0),
    sentRaw: BigInt(0),
    netRaw: BigInt(0)
  };
  wallets.set(address, wallet);
  return wallet;
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseJsonRecord(value: string): Record<string, number | string | boolean | null> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function safeParseObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function nullableNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : null;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

function findNearestMarketSnapshot(tokenAddress: string, targetTime: string, direction: "before" | "after") {
  const op = direction === "before" ? "<=" : ">=";
  const order = direction === "before" ? "desc" : "asc";
  return getDatabase().prepare(`
    select price_usd, liquidity_usd, volume_24h, observed_at
    from token_market_snapshots
    where token_address = ? and observed_at ${op} ?
    order by observed_at ${order}
    limit 1
  `).get(tokenAddress.toLowerCase(), targetTime) as { price_usd: number | null; liquidity_usd: number | null; volume_24h: number | null; observed_at: string } | undefined;
}

function getMarketPricesBetween(tokenAddress: string, start: string, end: string) {
  const rows = getDatabase().prepare(`
    select price_usd
    from token_market_snapshots
    where token_address = ? and observed_at >= ? and observed_at <= ? and price_usd is not null
  `).all(tokenAddress.toLowerCase(), start, end) as Array<{ price_usd: number | null }>;
  return rows.map((row) => row.price_usd).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function classifyWalletEventOutcome(eventType: string, priceAtFire: number | null, priceAfter1h: number | null, maxUpsideAfter1h: number | null, maxDrawdownAfter1h: number | null): WalletEventPerformance["outcome"] {
  if (!priceAtFire || !priceAfter1h) return "unknown";
  const oneHourReturn = (priceAfter1h - priceAtFire) / priceAtFire;
  if (eventType === "distribution_pressure" || eventType === "indexer_partial") {
    if (oneHourReturn <= -0.03 || (maxDrawdownAfter1h ?? 0) <= -0.05) return "good";
    if (oneHourReturn >= 0.05 || (maxUpsideAfter1h ?? 0) >= 0.08) return "bad";
    return "neutral";
  }
  if (oneHourReturn >= 0.03 || (maxUpsideAfter1h ?? 0) >= 0.06) return "good";
  if (oneHourReturn <= -0.05 || (maxDrawdownAfter1h ?? 0) <= -0.08) return "bad";
  return "neutral";
}

function avg(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function buildFreshnessBucket(label: string, table: string, entityColumn: string, timeColumn: string, thresholdMs: number, activeWindowMs?: number) {
  const rows = getDatabase().prepare(`
    select ${entityColumn} as entity_id, max(${timeColumn}) as observed_at
    from ${table}
    where ${entityColumn} is not null
    group by ${entityColumn}
  `).all() as Array<{ entity_id: string; observed_at: string | null }>;
  return { label, table, thresholdMs, activeWindowMs, rows };
}

function scoreFreshnessBucket(bucket: ReturnType<typeof buildFreshnessBucket>, referenceTime: Date): DataFreshnessBucket {
  const referenceMs = referenceTime.getTime();
  const activeRows = bucket.activeWindowMs
    ? bucket.rows.filter((row) => {
        if (!row.observed_at) return false;
        const observedMs = new Date(row.observed_at).getTime();
        return Number.isFinite(observedMs) && referenceMs - observedMs <= bucket.activeWindowMs!;
      })
    : bucket.rows;
  const observedTimes = activeRows
    .map((row) => row.observed_at)
    .filter((value): value is string => Boolean(value));
  const staleEntities = activeRows.filter((row) => {
    if (!row.observed_at) return true;
    const observedMs = new Date(row.observed_at).getTime();
    return !Number.isFinite(observedMs) || referenceMs - observedMs > bucket.thresholdMs;
  }).length;
  const sortedTimes = observedTimes.slice().sort();
  return {
    label: bucket.label,
    table: bucket.table,
    totalEntities: activeRows.length,
    freshEntities: Math.max(0, activeRows.length - staleEntities),
    staleEntities,
    staleRate: activeRows.length ? staleEntities / activeRows.length : null,
    thresholdMs: bucket.thresholdMs,
    latestObservedAt: sortedTimes[sortedTimes.length - 1] ?? null,
    oldestObservedAt: sortedTimes[0] ?? null,
    warning: activeRows.length
      ? staleEntities === activeRows.length
        ? "All tracked entities in this bucket are stale."
        : staleEntities
          ? "Some tracked entities in this bucket are stale."
          : null
      : bucket.activeWindowMs
        ? "No active observations in the freshness window."
        : "No observations recorded for this bucket yet."
  };
}

function buildDisagreementIssue(
  tokenAddress: string,
  symbol: string | null,
  metric: SourceDisagreementIssue["metric"],
  column: "price_usd" | "liquidity_usd" | "market_cap" | "volume_24h",
  thresholdPct: number,
  rowsBySource: Map<string, { observed_at: string; price_usd: number | null; liquidity_usd: number | null; market_cap: number | null; volume_24h: number | null }>
): SourceDisagreementIssue | null {
  const sources = [...rowsBySource.entries()]
    .map(([source, row]) => ({ source, value: row[column], observedAt: row.observed_at }))
    .filter((item): item is { source: string; value: number; observedAt: string } => typeof item.value === "number" && Number.isFinite(item.value));
  if (sources.length < 2) return null;
  const observedTimes = sources
    .map((item) => new Date(item.observedAt).getTime())
    .filter((value) => Number.isFinite(value));
  if (observedTimes.length < 2 || Math.max(...observedTimes) - Math.min(...observedTimes) > SOURCE_DISAGREEMENT_MAX_SKEW_MS) return null;
  const values = sources.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === 0) return null;
  const disagreementPct = ((max - min) / max) * 100;
  if (disagreementPct <= thresholdPct) return null;
  return {
    tokenAddress,
    symbol,
    metric,
    disagreementPct: Number(disagreementPct.toFixed(2)),
    thresholdPct,
    sources
  };
}

function safely(fn: () => void): PersistResult {
  try {
    fn();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown data layer write error" };
  }
}

function withTransaction(fn: () => void) {
  const db = getDatabase();
  db.exec("begin immediate;");
  try {
    fn();
    db.exec("commit;");
  } catch (error) {
    db.exec("rollback;");
    throw error;
  }
}
