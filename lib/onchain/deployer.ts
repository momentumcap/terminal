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
        const info = await blockscout.getAddressInfo(normalized) as any;
        const extracted = extractBlockscoutCreation(info);
        deployer = extracted.deployer ?? deployer;
        creationTxHash = extracted.creationTxHash ?? creationTxHash;
        createdAt = extracted.createdAt ?? createdAt;
      } catch {
        warnings.push("Blockscout address creation metadata unavailable.");
      }
    }

    if (!deployer) {
      try {
        const source = await blockscout.getContractSource(normalized) as any;
        const extracted = extractBlockscoutCreation(source);
        deployer = extracted.deployer ?? deployer;
        creationTxHash = extracted.creationTxHash ?? creationTxHash;
        createdAt = extracted.createdAt ?? createdAt;
      } catch {
        warnings.push("Blockscout contract source creation metadata unavailable.");
      }
    }

    if (!deployer) {
      try {
        const txs = await blockscout.getTransactions(normalized);
        const first = oldestTransaction(txs);
        deployer = normalizeMaybeAddress(first?.from?.hash ?? first?.from_address_hash ?? first?.from_address ?? first?.from);
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

function extractBlockscoutCreation(payload: any) {
  const deployer = normalizeMaybeAddress(
    payload?.creator_address_hash ??
    payload?.creator_address?.hash ??
    payload?.creator_address ??
    payload?.created_contract?.creator_address_hash ??
    payload?.deployer?.hash ??
    payload?.deployer
  );
  const creationTxHash = stringish(
    payload?.creation_tx_hash ??
    payload?.creation_transaction_hash ??
    payload?.transaction_hash ??
    payload?.created_contract?.creation_tx_hash
  );
  const createdAt = stringish(payload?.created_at ?? payload?.creation_timestamp ?? payload?.timestamp);
  return { deployer, creationTxHash, createdAt };
}

function oldestTransaction(txs: any[]) {
  return [...txs].sort((a, b) => {
    const aTime = Date.parse(String(a?.timestamp ?? ""));
    const bTime = Date.parse(String(b?.timestamp ?? ""));
    if (Number.isFinite(aTime) && Number.isFinite(bTime)) return aTime - bTime;
    const aBlock = Number(a?.block_number ?? a?.blockNumber ?? 0);
    const bBlock = Number(b?.block_number ?? b?.blockNumber ?? 0);
    return aBlock - bBlock;
  })[0];
}

function normalizeMaybeAddress(value: unknown) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value) ? normalizeAddress(value) : undefined;
}

function stringish(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
