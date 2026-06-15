import { formatEther } from "viem";
import { getBalance, getCode } from "@/lib/onchain/client";
import { createDataQuality, normalizeAddress } from "@/lib/onchain/config";
import { ONCHAIN_TTLS, withOnchainCache } from "@/lib/onchain/cache";
import * as blockscout from "@/lib/onchain/providers/blockscout";
import * as alchemy from "@/lib/onchain/providers/alchemy";
import type { WalletProfile } from "@/lib/onchain/types";

export async function getWalletProfile(address: string): Promise<WalletProfile> {
  const normalized = normalizeAddress(address);
  return withOnchainCache(`wallet:${normalized}`, ONCHAIN_TTLS.wallet, async () => {
    const [balance, code] = await Promise.all([getBalance(normalized).catch(() => BigInt(0)), getCode(normalized).catch(() => undefined)]);
    const sourcesTried = ["BaseRPC"];
    const riskFlags: string[] = [];
    let txCount: number | undefined;
    let recentActivity: WalletProfile["recentActivity"] = [];
    let tokenBalances: unknown[] | undefined;

    try {
      sourcesTried.push("Blockscout");
      const txs = await blockscout.getTransactions(normalized);
      txCount = txs.length;
      recentActivity = txs.slice(0, 10).map((tx: any) => ({ txHash: String(tx.hash), timestamp: tx.timestamp, type: "transaction", counterparty: tx.to?.hash ?? tx.from?.hash }));
    } catch {
      riskFlags.push("indexer_activity_unavailable");
    }

    if (alchemy.isAlchemyConfigured()) {
      try {
        sourcesTried.push("Alchemy");
        const balances: any = await alchemy.getTokenBalances(normalized);
        tokenBalances = balances?.tokenBalances ?? [];
      } catch {
        riskFlags.push("alchemy_balances_unavailable");
      }
    }

    const ethBalance = Number(formatEther(balance));
    const labels = code && code !== "0x" ? ["contract"] : [];
    return {
      address: normalized,
      ethBalance,
      tokenBalances,
      txCount,
      labels,
      category: classifyWallet({ isContract: Boolean(code && code !== "0x"), ethBalance, txCount }),
      recentActivity,
      riskFlags,
      dataQuality: createDataQuality({ source: "BaseRPC", sourcesTried, confidence: txCount !== undefined ? "medium" : "low", isPartial: txCount === undefined, missingFields: txCount === undefined ? ["txCount", "recentActivity"] : [], warnings: riskFlags })
    };
  });
}

export function classifyWallet(input: { isContract?: boolean; ethBalance?: number; txCount?: number }) {
  if (input.isContract) return "likely_contract";
  if ((input.ethBalance ?? 0) > 50) return "likely_whale";
  if ((input.txCount ?? 0) > 200) return "active_wallet";
  if ((input.txCount ?? 0) < 5) return "fresh_wallet";
  return "unknown";
}
