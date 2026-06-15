import { createDataQuality, normalizeAddress } from "@/lib/onchain/config";
import { ONCHAIN_TTLS, withOnchainCache } from "@/lib/onchain/cache";
import { getTokenTransferLogs } from "@/lib/onchain/transfers";
import { getLiquidityEvents } from "@/lib/onchain/liquidity";
import { getContractRiskProfile } from "@/lib/onchain/contractRisk";
import * as blockscout from "@/lib/onchain/providers/blockscout";
import type { RecentTokenEvent } from "@/lib/onchain/types";

export async function getRecentTokenEvents(tokenAddress: string): Promise<RecentTokenEvent[]> {
  const normalized = normalizeAddress(tokenAddress);
  return withOnchainCache(`events:${normalized}`, ONCHAIN_TTLS.events, async () => {
    const [rpcTransfers, indexerTransfers, liquidity, risk] = await Promise.all([
      withDeadline(getTokenTransferLogs(normalized), [], 1_200),
      withDeadline(blockscout.getTokenTransfers(normalized), [], 2_500),
      withDeadline(getLiquidityEvents(normalized), [], 1_500),
      withDeadline(getContractRiskProfile(normalized), null, 2_500)
    ]);
    const events: RecentTokenEvent[] = [];
    for (const transfer of normalizeBlockscoutTransfers(normalized, indexerTransfers).slice(0, 25)) {
      events.push(transfer);
    }
    for (const transfer of rpcTransfers.slice(-25).reverse()) {
      if (events.some((event) => event.txHash === transfer.txHash)) continue;
      const large = BigInt(transfer.valueRaw) > BigInt(0) && transfer.valueRaw.length > 24;
      events.push({
        id: `${transfer.txHash}-${transfer.blockNumber}`,
        tokenAddress: normalized,
        type: large ? "large_transfer" : "transfer",
        severity: large ? "warning" : "info",
        message: large ? "Large token transfer detected from Base RPC logs." : "Token transfer detected from Base RPC logs.",
        txHash: transfer.txHash,
        wallet: transfer.to,
        timestamp: transfer.timestamp ?? new Date().toISOString(),
        source: "BaseRPC"
      });
    }
    for (const item of liquidity.slice(0, 5)) {
      events.push({
        id: item.txHash,
        tokenAddress: normalized,
        type: item.type === "add" ? "lp_add" : item.type === "remove" ? "lp_remove" : "swap",
        severity: item.type === "remove" ? "danger" : "info",
        message: `Liquidity signal detected${item.dex ? ` on ${item.dex}` : ""}.`,
        txHash: item.txHash.startsWith("market-") ? undefined : item.txHash,
        wallet: item.wallet,
        amountUsd: item.amountUsd,
        timestamp: item.timestamp ?? new Date().toISOString(),
        source: "market/BaseRPC"
      });
    }
    for (const flag of risk?.riskFlags ?? []) {
      events.push({
        id: `risk-${flag.type}`,
        tokenAddress: normalized,
        type: "owner_action",
        severity: flag.severity === "danger" ? "danger" : "warning",
        message: flag.message,
        timestamp: new Date().toISOString(),
        source: risk?.dataQuality.source ?? "risk"
      });
    }
    return events.slice(0, 40);
  });
}

export function eventsDataQuality(count: number) {
  return createDataQuality({ source: "BaseRPC/market", sourcesTried: ["BaseRPC", "DexScreener", "GeckoTerminal"], confidence: count ? "medium" : "low", isPartial: true, missingFields: count ? [] : ["events"], warnings: ["Live event stream is best-effort until a dedicated indexer is configured."] });
}

function normalizeBlockscoutTransfers(tokenAddress: string, items: any[]): RecentTokenEvent[] {
  return items.map((item, index) => {
    const txHash = String(item.transaction_hash ?? item.tx_hash ?? item.tx?.hash ?? item.hash ?? `blockscout-transfer-${index}`);
    const from = item.from?.hash ?? item.from_address_hash ?? item.from?.address_hash ?? item.from;
    const to = item.to?.hash ?? item.to_address_hash ?? item.to?.address_hash ?? item.to;
    const raw = String(item.total?.value ?? item.value ?? item.amount ?? "0");
    const large = raw.length > 24;
    return {
      id: `${txHash}-${item.log_index ?? index}`,
      tokenAddress,
      type: large ? "large_transfer" as const : "transfer" as const,
      severity: large ? "warning" as const : "info" as const,
      message: large ? "Large token transfer detected from Blockscout token transfer feed." : "Token transfer detected from Blockscout token transfer feed.",
      txHash,
      wallet: to ? String(to).toLowerCase() : from ? String(from).toLowerCase() : undefined,
      timestamp: item.timestamp ? String(item.timestamp) : new Date().toISOString(),
      source: "Blockscout"
    };
  });
}

async function withDeadline<T>(promise: Promise<T>, fallback: T, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => resolve(fallback), timeoutMs);
      })
    ]);
  } catch {
    return fallback;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
