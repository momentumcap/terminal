export const POLL_INTERVALS = {
  terminalMs: 15_000,
  analysisMs: 30_000,
  bankrMs: 20_000
} as const;

export const CACHE_TTLS = {
  dexAddressMs: 10_000,
  dexSearchMs: 10_000,
  geckoDiscoveryMs: 30_000,
  bankrLaunchesMs: 20_000,
  analysisMs: 10_000,
  ownOnchainMs: 10_000
} as const;

export function ageMs(iso: string | null | undefined) {
  if (!iso) return Number.POSITIVE_INFINITY;
  const value = Date.now() - new Date(iso).getTime();
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

export function freshnessLabel(iso: string | null | undefined) {
  const age = ageMs(iso);
  if (!Number.isFinite(age)) return "never synced";
  if (age < 1000) return "just now";
  if (age < 60_000) return `${Math.round(age / 1000)}s ago`;
  return `${Math.round(age / 60_000)}m ago`;
}

export function isStale(iso: string | null | undefined, maxAgeMs: number) {
  return ageMs(iso) > maxAgeMs;
}
