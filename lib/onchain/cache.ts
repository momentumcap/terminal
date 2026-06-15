import { recordCacheEvent } from "@/lib/cacheTelemetry";

type CacheEntry<T> = { value: T; expiresAt: number };

export const ONCHAIN_TTLS = {
  tokenMetadata: 24 * 60 * 60 * 1000,
  contractRisk: 6 * 60 * 60 * 1000,
  deployerProfile: 60 * 60 * 1000,
  holders: 10 * 60 * 1000,
  events: 45 * 1000,
  transfers: 24 * 60 * 60 * 1000,
  liquidity: 60 * 1000,
  wallet: 5 * 60 * 1000
};

const cache = new Map<string, CacheEntry<unknown>>();

export async function withOnchainCache<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const existing = cache.get(key);
  if (existing && existing.expiresAt > Date.now()) {
    recordCacheEvent({ namespace: "onchain", key, type: "hit", cacheAgeMs: existing.expiresAt - Date.now() });
    return existing.value as T;
  }
  if (existing) {
    recordCacheEvent({ namespace: "onchain", key, type: "expired", cacheAgeMs: Date.now() - existing.expiresAt });
  } else {
    recordCacheEvent({ namespace: "onchain", key, type: "miss" });
  }
  const value = await loader();
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  recordCacheEvent({ namespace: "onchain", key, type: "set", ttlMs });
  return value;
}
