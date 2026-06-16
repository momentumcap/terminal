import { readLatestOnchainComponentSnapshot } from "@/lib/db/repository";
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

export function readIndexedAnalysisComponents(address: string) {
  return {
    ownData: readLatestOnchainComponentSnapshot<OwnOnchainSnapshot>(address, "ownData", COMPONENT_MAX_AGE_MS.ownData)?.payload ?? null,
    profile: readLatestOnchainComponentSnapshot<OnchainTokenProfile>(address, "profile", COMPONENT_MAX_AGE_MS.profile)?.payload ?? null,
    holders: readLatestOnchainComponentSnapshot<HolderDistribution>(address, "holders", COMPONENT_MAX_AGE_MS.holders)?.payload ?? null,
    risk: readLatestOnchainComponentSnapshot<ContractRiskProfile>(address, "risk", COMPONENT_MAX_AGE_MS.risk)?.payload ?? null,
    deployer: readLatestOnchainComponentSnapshot<DeployerProfile>(address, "deployer", COMPONENT_MAX_AGE_MS.deployer)?.payload ?? null,
    events: readLatestOnchainComponentSnapshot<RecentTokenEvent[]>(address, "events", COMPONENT_MAX_AGE_MS.events)?.payload ?? null
  };
}
