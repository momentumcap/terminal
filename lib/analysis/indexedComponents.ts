import { readLatestHolderSnapshot, readLatestOnchainComponentSnapshot } from "@/lib/db/repository";
import { readLatestOnchainComponentSnapshotPostgres } from "@/lib/db/postgres";
import type { OwnOnchainSnapshot } from "@/lib/onchain/snapshot";
import type { ContractRiskProfile, DeployerProfile, HolderDistribution, OnchainTokenProfile, RecentTokenEvent } from "@/lib/onchain/types";

const COMPONENT_MAX_AGE_MS = {
  ownData: 10 * 60_000,
  profile: 24 * 60 * 60_000,
  holders: 60 * 60_000,
  risk: 12 * 60 * 60_000,
  deployer: 24 * 60 * 60_000,
  events: 15 * 60_000
};

const COMPONENT_STALE_FALLBACK_MAX_AGE_MS = {
  ownData: 14 * 24 * 60 * 60_000,
  profile: 30 * 24 * 60 * 60_000,
  holders: 6 * 60 * 60_000,
  risk: 30 * 24 * 60 * 60_000,
  deployer: 30 * 24 * 60 * 60_000,
  events: 14 * 24 * 60 * 60_000
};

export async function readIndexedAnalysisComponents(address: string) {
  return {
    ownData: await readComponent<OwnOnchainSnapshot>(address, "ownData", COMPONENT_MAX_AGE_MS.ownData),
    profile: await readComponent<OnchainTokenProfile>(address, "profile", COMPONENT_MAX_AGE_MS.profile),
    holders: await readComponent<HolderDistribution>(address, "holders", COMPONENT_MAX_AGE_MS.holders) ?? readLatestHolderSnapshot(address, COMPONENT_MAX_AGE_MS.holders),
    risk: await readComponent<ContractRiskProfile>(address, "risk", COMPONENT_MAX_AGE_MS.risk),
    deployer: await readComponent<DeployerProfile>(address, "deployer", COMPONENT_MAX_AGE_MS.deployer),
    events: await readComponent<RecentTokenEvent[]>(address, "events", COMPONENT_MAX_AGE_MS.events)
  };
}

async function readComponent<T>(address: string, component: Parameters<typeof readLatestOnchainComponentSnapshot>[1], maxAgeMs: number): Promise<T | null> {
  const local = readLatestOnchainComponentSnapshot<T>(address, component, maxAgeMs)?.payload ?? null;
  if (local) return local;
  const durable = (await readLatestOnchainComponentSnapshotPostgres<T>(address, component, maxAgeMs))?.payload ?? null;
  if (durable) return durable;

  const fallbackMaxAgeMs = COMPONENT_STALE_FALLBACK_MAX_AGE_MS[component];
  const staleLocal = readLatestOnchainComponentSnapshot<T>(address, component, fallbackMaxAgeMs);
  if (staleLocal?.payload) return markSnapshotFallback(staleLocal.payload, staleLocal.observedAt, component);

  const staleDurable = await readLatestOnchainComponentSnapshotPostgres<T>(address, component, fallbackMaxAgeMs);
  if (staleDurable?.payload) return markSnapshotFallback(staleDurable.payload, staleDurable.observedAt, component);
  return null;
}

function markSnapshotFallback<T>(payload: T, observedAt: string, component: string): T {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return payload;
  const clone = structuredCloneCompat(payload) as T & { dataQuality?: any };
  if (!clone.dataQuality || typeof clone.dataQuality !== "object") return clone;
  clone.dataQuality = {
    ...clone.dataQuality,
    confidence: clone.dataQuality.confidence === "high" ? "medium" : clone.dataQuality.confidence ?? "low",
    isPartial: true,
    warnings: [
      ...new Set([
        ...(Array.isArray(clone.dataQuality.warnings) ? clone.dataQuality.warnings : []),
        `${component} restored from an exact-address indexed snapshot observed at ${observedAt}; live refresh is pending.`
      ])
    ],
    fetchedAt: clone.dataQuality.fetchedAt ?? observedAt
  };
  return clone;
}

function structuredCloneCompat<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
