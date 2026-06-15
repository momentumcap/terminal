import { fetchBestTokenMarketData } from "@/lib/marketData";
import { createDataQuality, normalizeAddress } from "@/lib/onchain/config";
import { ONCHAIN_TTLS, withOnchainCache } from "@/lib/onchain/cache";
import { getTokenTransferLogs } from "@/lib/onchain/transfers";
import type { LiquidityEvent, TradeabilityProfile } from "@/lib/onchain/types";

export async function getLiquidityEvents(tokenAddress: string): Promise<LiquidityEvent[]> {
  const normalized = normalizeAddress(tokenAddress);
  return withOnchainCache(`liquidity:${normalized}`, ONCHAIN_TTLS.liquidity, async () => {
    const market = await fetchBestTokenMarketData(normalized).catch(() => []);
    const transfers = await getTokenTransferLogs(normalized).catch(() => []);
    const events: LiquidityEvent[] = market.slice(0, 5).map((pair) => ({
      txHash: `market-${pair.pairAddress}`,
      poolAddress: pair.pairAddress,
      dex: pair.dexId,
      tokenAddress: normalized,
      type: "unknown",
      amountUsd: pair.liquidityUsd ?? undefined,
      timestamp: pair.updatedAt
    }));
    for (const transfer of transfers.slice(0, 10)) {
      events.push({
        txHash: transfer.txHash,
        tokenAddress: normalized,
        type: "unknown",
        wallet: transfer.to,
        timestamp: transfer.timestamp
      });
    }
    return events;
  });
}

export async function getTokenTradeabilityProfile(tokenAddress: string): Promise<TradeabilityProfile> {
  const normalized = normalizeAddress(tokenAddress);
  const market = await fetchBestTokenMarketData(normalized).catch(() => []);
  const best = market[0];
  const liquidity = best?.liquidityUsd ?? 0;
  const warnings = [
    liquidity < 10_000 ? "Low liquidity can make exits difficult." : "",
    !best ? "No market pair was found from public market data providers." : ""
  ].filter(Boolean);
  return {
    tokenAddress: normalized,
    liquidityUsd: liquidity || undefined,
    safeSizingUsd: liquidity ? Math.max(100, Math.min(10_000, liquidity * 0.015)) : undefined,
    warnings,
    dataQuality: createDataQuality({ source: best ? best.primaryMarketSource ?? "DexScreener" : "market-data", sourcesTried: ["DexScreener", "GeckoTerminal"], confidence: best ? "medium" : "low", isPartial: true, missingFields: best ? ["sellSimulation"] : ["liquidity", "sellSimulation"], warnings })
  };
}
