import { getNewTokens, getTrendingTokens } from "@/lib/data";
import { fetchBankrLaunchFeedSnapshot } from "@/lib/bankr";
import { sampleTrackedTokenMarkets, type MarketSamplerResult } from "@/lib/indexer/marketSampler";

type FreshnessStatus = {
  enabled: boolean;
  running: boolean;
  intervalMs: number;
  marketLimit: number;
  startedAt: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  runCount: number;
  lastResult: FreshnessRunResult | null;
  lastError: string | null;
};

export type FreshnessRunResult = {
  startedAt: string;
  finishedAt: string;
  trendingCount: number;
  newCount: number;
  bankrCount: number;
  marketSample: MarketSamplerResult;
  warnings: string[];
};

const state: FreshnessStatus = {
  enabled: false,
  running: false,
  intervalMs: 30_000,
  marketLimit: 10,
  startedAt: null,
  lastRunAt: null,
  nextRunAt: null,
  runCount: 0,
  lastResult: null,
  lastError: null
};

let timer: ReturnType<typeof setInterval> | null = null;

export function getFreshnessServiceStatus(): FreshnessStatus {
  return {
    ...state,
    lastResult: state.lastResult ? { ...state.lastResult } : null
  };
}

export function startFreshnessService(options: Partial<Pick<FreshnessStatus, "intervalMs" | "marketLimit">> = {}) {
  enableFreshnessService(options);
  void runFreshnessWarmup();
  return getFreshnessServiceStatus();
}

export async function ensureFreshnessService(options: Partial<Pick<FreshnessStatus, "intervalMs" | "marketLimit">> = {}): Promise<FreshnessStatus> {
  enableFreshnessService(options);
  const lastRunMs = state.lastRunAt ? new Date(state.lastRunAt).getTime() : 0;
  const runIsStale = !Number.isFinite(lastRunMs) || !lastRunMs || Date.now() - lastRunMs > state.intervalMs;
  if (runIsStale && !state.running) return runFreshnessWarmup({ marketLimit: state.marketLimit });
  return getFreshnessServiceStatus();
}

function enableFreshnessService(options: Partial<Pick<FreshnessStatus, "intervalMs" | "marketLimit">> = {}) {
  state.intervalMs = clamp(options.intervalMs ?? state.intervalMs, 15_000, 5 * 60_000);
  state.marketLimit = clamp(options.marketLimit ?? state.marketLimit, 3, 20);
  state.enabled = true;
  state.startedAt = state.startedAt ?? new Date().toISOString();
  state.nextRunAt = new Date(Date.now() + state.intervalMs).toISOString();
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    void runFreshnessWarmup();
  }, state.intervalMs);
}

export function stopFreshnessService() {
  if (timer) clearInterval(timer);
  timer = null;
  state.enabled = false;
  state.nextRunAt = null;
  return getFreshnessServiceStatus();
}

export async function runFreshnessWarmup(options: { marketLimit?: number } = {}): Promise<FreshnessStatus> {
  if (state.running) return getFreshnessServiceStatus();
  state.running = true;
  state.lastError = null;
  const startedAt = new Date().toISOString();
  const warnings: string[] = [];
  let trendingCount = 0;
  let newCount = 0;
  let bankrCount = 0;

  try {
    const [trending, fresh, bankr] = await Promise.all([
      getTrendingTokens().catch((error) => {
        warnings.push(`trending: ${error instanceof Error ? error.message : "refresh failed"}`);
        return [];
      }),
      getNewTokens().catch((error) => {
        warnings.push(`new pools: ${error instanceof Error ? error.message : "refresh failed"}`);
        return [];
      }),
      fetchBankrLaunchFeedSnapshot().catch((error) => {
        warnings.push(`bankr: ${error instanceof Error ? error.message : "refresh failed"}`);
        return [];
      })
    ]);
    trendingCount = trending.length;
    newCount = fresh.length;
    bankrCount = bankr.length;

    const marketSample = await sampleTrackedTokenMarkets({
      limit: options.marketLimit ?? state.marketLimit
    });
    state.lastResult = {
      startedAt,
      finishedAt: new Date().toISOString(),
      trendingCount,
      newCount,
      bankrCount,
      marketSample,
      warnings: [...warnings, ...marketSample.warnings]
    };
    state.lastRunAt = state.lastResult.finishedAt;
    state.runCount += 1;
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : "Freshness warmup failed";
  } finally {
    state.running = false;
    state.nextRunAt = state.enabled ? new Date(Date.now() + state.intervalMs).toISOString() : null;
  }

  return getFreshnessServiceStatus();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? Math.round(value) : min));
}
