import { indexTrackedHolderWallets, type HolderIndexerBatchResult } from "@/lib/indexer/holderWalletIndexer";
import { sampleTrackedTokenMarkets, type MarketSamplerResult } from "@/lib/indexer/marketSampler";

type SchedulerStatus = {
  enabled: boolean;
  running: boolean;
  intervalMs: number;
  batchLimit: number;
  lookbackBlocks: number;
  startedAt: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  runCount: number;
  lastResult: HolderIndexerBatchResult | null;
  lastMarketSample: MarketSamplerResult | null;
  lastError: string | null;
};

const state: SchedulerStatus = {
  enabled: false,
  running: false,
  intervalMs: 120_000,
  batchLimit: 2,
  lookbackBlocks: 1_800,
  startedAt: null,
  lastRunAt: null,
  nextRunAt: null,
  runCount: 0,
  lastResult: null,
  lastMarketSample: null,
  lastError: null
};

let timer: ReturnType<typeof setInterval> | null = null;

export function getHolderIndexerSchedulerStatus(): SchedulerStatus {
  return {
    ...state,
    lastResult: state.lastResult ? { ...state.lastResult } : null,
    lastMarketSample: state.lastMarketSample ? { ...state.lastMarketSample } : null
  };
}

export function startHolderIndexerScheduler(options: Partial<Pick<SchedulerStatus, "intervalMs" | "batchLimit" | "lookbackBlocks">> = {}) {
  state.intervalMs = clamp(options.intervalMs ?? state.intervalMs, 30_000, 15 * 60_000);
  state.batchLimit = clamp(options.batchLimit ?? state.batchLimit, 1, 5);
  state.lookbackBlocks = clamp(options.lookbackBlocks ?? state.lookbackBlocks, 100, 14_400);
  state.enabled = true;
  state.startedAt = state.startedAt ?? new Date().toISOString();
  state.nextRunAt = new Date(Date.now() + state.intervalMs).toISOString();
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    void runHolderIndexerSchedulerTick();
  }, state.intervalMs);
  return getHolderIndexerSchedulerStatus();
}

export function stopHolderIndexerScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
  state.enabled = false;
  state.nextRunAt = null;
  return getHolderIndexerSchedulerStatus();
}

export async function runHolderIndexerSchedulerTick() {
  if (state.running) return getHolderIndexerSchedulerStatus();
  state.running = true;
  state.lastError = null;
  try {
    const result = await indexTrackedHolderWallets({
      limit: state.batchLimit,
      lookbackBlocks: state.lookbackBlocks
    });
    const marketSample = await sampleTrackedTokenMarkets({ limit: state.batchLimit });
    state.lastResult = result;
    state.lastMarketSample = marketSample;
    state.lastRunAt = new Date().toISOString();
    state.runCount += 1;
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : "Scheduled holder indexer run failed";
  } finally {
    state.running = false;
    state.nextRunAt = state.enabled ? new Date(Date.now() + state.intervalMs).toISOString() : null;
  }
  return getHolderIndexerSchedulerStatus();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? Math.round(value) : min));
}
