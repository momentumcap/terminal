import { readLatestHolderSnapshot, readLatestOnchainComponentSnapshot } from "@/lib/db/repository";
import { readLatestOnchainComponentSnapshotPostgres } from "@/lib/db/postgres";
import type { OwnOnchainSnapshot } from "@/lib/onchain/snapshot";
import type { ContractRiskProfile, DeployerProfile, HolderDistribution, OnchainTokenProfile, RecentTokenEvent } from "@/lib/onchain/types";

const COMPONENT_MAX_AGE_MS = {
  ownData: 2 * 60_000,
  profile: 24 * 60 * 60_000,
  holders: 15 * 60_000,
  risk: 6 * 60 * 60_000,
  deployer: 60 * 60_000,
  events: 2 * 60_000
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
  return (await readLatestOnchainComponentSnapshotPostgres<T>(address, component, maxAgeMs))?.payload ?? null;
}
