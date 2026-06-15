import type { CacheEntry, WatchlistEntry } from "@/lib/types";
import { upsertTrackedIndexerToken } from "@/lib/db/repository";
import { recordCacheEvent } from "@/lib/cacheTelemetry";

const cache = new Map<string, CacheEntry<unknown>>();
const watchlist = new Map<string, WatchlistEntry>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) {
    recordCacheEvent({ namespace: "general", key, type: "miss" });
    return null;
  }
  const remainingMs = entry.expiresAt - Date.now();
  if (remainingMs < 0) {
    recordCacheEvent({ namespace: "general", key, type: "expired", cacheAgeMs: Math.abs(remainingMs) });
    cache.delete(key);
    return null;
  }
  recordCacheEvent({ namespace: "general", key, type: "hit", cacheAgeMs: remainingMs });
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs = 60_000): T {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  recordCacheEvent({ namespace: "general", key, type: "set", ttlMs });
  return value;
}

export async function withCache<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const cached = getCached<T>(key);
  if (cached) return cached;
  const value = await loader();
  return setCached(key, value, ttlMs);
}

export function upsertWatchlist(entry: Omit<WatchlistEntry, "createdAt">): WatchlistEntry {
  const value = { ...entry, createdAt: new Date().toISOString() };
  watchlist.set(entry.tokenAddress.toLowerCase(), value);
  upsertTrackedIndexerToken({ tokenAddress: entry.tokenAddress, symbol: entry.symbol, reason: "watchlist", priority: 80 });
  return value;
}

export function listWatchlist(): WatchlistEntry[] {
  return Array.from(watchlist.values());
}
