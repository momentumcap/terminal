import { formatEther } from "viem";
import { getBalance } from "@/lib/onchain/client";
import { createDataQuality, normalizeAddress } from "@/lib/onchain/config";
import { ONCHAIN_TTLS, withOnchainCache } from "@/lib/onchain/cache";
import * as basescan from "@/lib/onchain/providers/basescan";
import * as blockscout from "@/lib/onchain/providers/blockscout";
import type { DeployerProfile } from "@/lib/onchain/types";

export async function getDeployerProfile(tokenAddress: string): Promise<DeployerProfile> {
  const normalized = normalizeAddress(tokenAddress);
  return withOnchainCache(`deployer:${normalized}`, ONCHAIN_TTLS.deployerProfile, async () => {
    const sourcesTried = ["BaseScan", "Blockscout"];
    const warnings: string[] = [];
    let deployer: string | undefined;
    let creationTxHash: string | undefined;
    let createdAt: string | undefined;

    try {
      const creation = await basescan.getContractCreation(normalized);
      deployer = creation?.contractCreator ? normalizeAddress(String(creation.contractCreator)) : undefined;
      creationTxHash = creation?.txHash;
    } catch {
      warnings.push("BaseScan contract creation unavailable.");
    }

    if (!deployer) {
      try {
        const txs = await blockscout.getTransactions(normalized);
        const first = txs.at(-1);
        deployer = first?.from?.hash ? normalizeAddress(String(first.from.hash)) : undefined;
        creationTxHash = String(first?.hash ?? creationTxHash ?? "");
        createdAt = first?.timestamp ? String(first.timestamp) : undefined;
      } catch {
        warnings.push("Blockscout creation inference unavailable.");
      }
    }

    const deployerEthBalance = deployer ? Number(formatEther(await getBalance(deployer).catch(() => BigInt(0)))) : undefined;
    const reputationScore = deployer ? 62 + Math.min(18, Math.log10(Math.max(deployerEthBalance ?? 0, 0.001)) * 8) : 50;

    return {
      tokenAddress: normalized,
      deployer,
      creationTxHash,
      createdAt,
      deployerEthBalance,
      priorLaunches: [],
      suspiciousHistory: false,
      reputationScore: Math.round(Math.max(0, Math.min(100, reputationScore))),
      dataQuality: createDataQuality({
        source: deployer ? "BaseScan/Blockscout" : "BaseRPC",
        sourcesTried,
        confidence: deployer ? "medium" : "low",
        isPartial: true,
        missingFields: deployer ? ["priorLaunches"] : ["deployer", "priorLaunches"],
        warnings: deployer ? warnings : [...warnings, "Deployer could not be resolved from configured indexers."]
      })
    };
  });
}
