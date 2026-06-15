import { formatUnits } from "viem";
import { getERC20Metadata } from "@/lib/onchain/erc20";
import { BASE_CHAIN_ID, createDataQuality, normalizeAddress } from "@/lib/onchain/config";
import { ONCHAIN_TTLS, withOnchainCache } from "@/lib/onchain/cache";
import { getTokenTransferLogs } from "@/lib/onchain/transfers";
import * as blockscout from "@/lib/onchain/providers/blockscout";
import { persistHolderSnapshot } from "@/lib/db/repository";
import type { HolderDistribution, HolderQueryOptions, TokenHolder } from "@/lib/onchain/types";

export async function getTokenHolders(address: string, options: HolderQueryOptions = {}): Promise<HolderDistribution> {
  const normalized = normalizeAddress(address);
  const limit = options.limit ?? 50;
  const distribution = await withOnchainCache(`holders:${normalized}:${limit}:${options.mode ?? "auto"}`, ONCHAIN_TTLS.holders, async () => {
    if (options.mode !== "rpc") {
      try {
        const [items, token, tokenInfo] = await Promise.all([
          blockscout.getTokenHolders(normalized),
          getERC20Metadata(normalized),
          blockscout.getTokenInfo(normalized).catch(() => null)
        ]);
        const tokenDecimals = token.decimals ?? readTokenDecimals(tokenInfo);
        const tokenSupply = token.totalSupply ?? readTokenSupply(tokenInfo);
        const holders = normalizeBlockscoutHolders(items, tokenDecimals ?? undefined, tokenSupply ?? undefined).slice(0, limit);
        const totalHolders = readTotalHolders(tokenInfo, items);
        if (holders.length) {
          return buildDistribution(
            normalized,
            holders,
            "Blockscout",
            totalHolders ? [] : ["Blockscout returned holder balances but did not expose a total holder count in this response. Showing sampled top holders only."],
            totalHolders ? "high" : "medium",
            totalHolders
          );
        }
      } catch {
        if (options.mode === "indexer") return emptyDistribution(normalized, "Blockscout", ["Blockscout holder endpoint unavailable."]);
      }
    }
    return reconstructHoldersFromTransfers(normalized, options);
  });
  persistHolderSnapshot(distribution);
  return distribution;
}

export async function getTokenOwnershipDistribution(address: string) {
  return getTokenHolders(address, { limit: 50, mode: "auto" });
}

function normalizeBlockscoutHolders(items: any[], decimals?: number, totalSupply?: string): TokenHolder[] {
  return items.map((item) => {
    const raw = String(item.value ?? item.balance ?? item.token?.balance ?? "0");
    const pct = totalSupply && Number(totalSupply) ? Number((BigInt(raw) * BigInt(10_000)) / BigInt(totalSupply)) / 100 : undefined;
    const address = normalizeAddress(String(item.address?.hash ?? item.address_hash ?? item.address ?? ""));
    const label = item.address?.name || item.address?.ens_domain_name || undefined;
    const category = classifyHolder(address, Boolean(item.address?.is_contract), pct, label);
    return {
      address,
      balanceRaw: raw,
      balanceFormatted: decimals !== undefined ? Number(formatUnits(BigInt(raw), decimals)) : undefined,
      ownershipPct: pct,
      isContract: Boolean(item.address?.is_contract),
      label,
      category
    };
  }).filter((holder) => /^0x[a-f0-9]{40}$/.test(holder.address));
}

async function reconstructHoldersFromTransfers(address: string, options: HolderQueryOptions): Promise<HolderDistribution> {
  const token = await getERC20Metadata(address).catch(() => ({ chainId: BASE_CHAIN_ID, address, decimals: undefined, totalSupply: undefined }));
  const transfers = await getTokenTransferLogs(address, options.fromBlock, options.toBlock);
  const balances = new Map<string, bigint>();
  for (const transfer of transfers) {
    const value = BigInt(transfer.valueRaw);
    if (!/^0x0{40}$/.test(transfer.from)) balances.set(transfer.from, (balances.get(transfer.from) ?? BigInt(0)) - value);
    if (!/^0x0{40}$/.test(transfer.to)) balances.set(transfer.to, (balances.get(transfer.to) ?? BigInt(0)) + value);
  }
  const holders = [...balances.entries()]
    .filter(([, balance]) => balance > BigInt(0))
    .sort((a, b) => b[1] > a[1] ? 1 : -1)
    .slice(0, options.limit ?? 50)
    .map(([holder, balance]) => {
      const pct = token.totalSupply && BigInt(token.totalSupply) > BigInt(0) ? Number((balance * BigInt(10_000)) / BigInt(token.totalSupply)) / 100 : undefined;
      return {
        address: holder,
        balanceRaw: balance.toString(),
        balanceFormatted: token.decimals !== undefined ? Number(formatUnits(balance, token.decimals)) : undefined,
        ownershipPct: pct,
        category: classifyHolder(holder, false, pct)
      };
    });
  return buildDistribution(address, holders, "BaseRPC", ["RPC holder reconstruction may be incomplete for older tokens because only the bounded transfer window is replayed. Total holder count is unknown in RPC fallback mode."], "low");
}

function buildDistribution(tokenAddress: string, holders: TokenHolder[], source: string, warnings: string[], confidence: "high" | "medium" | "low", totalHolders?: number): HolderDistribution {
  const pct = (count: number) => holders.slice(0, count).reduce((sum, holder) => sum + (holder.ownershipPct ?? 0), 0);
  const rawTop50Pct = pct(50);
  const top10Pct = Math.min(100, pct(10));
  const top25Pct = Math.min(100, pct(25));
  const top50Pct = Math.min(100, rawTop50Pct);
  const whalePct = holders.filter((holder) => holder.category === "whale").reduce((sum, holder) => sum + (holder.ownershipPct ?? 0), 0);
  const lpPct = holders.filter((holder) => holder.category === "lp").reduce((sum, holder) => sum + (holder.ownershipPct ?? 0), 0);
  const contractPct = holders.filter((holder) => holder.category === "contract").reduce((sum, holder) => sum + (holder.ownershipPct ?? 0), 0);
  const burnPct = holders.filter((holder) => holder.category === "burn").reduce((sum, holder) => sum + (holder.ownershipPct ?? 0), 0);
  const deployerPct = holders.filter((holder) => holder.category === "deployer").reduce((sum, holder) => sum + (holder.ownershipPct ?? 0), 0);
  const retailPct = Math.max(0, 100 - whalePct - lpPct - contractPct - burnPct - deployerPct);
  const topHolder = holders[0];
  const consistencyWarnings = rawTop50Pct > 100.5 ? ["Top-holder sample exceeds 100% of reported supply. Provider balances may include rebasing, wrappers, or stale supply metadata. Treat percentage buckets directionally."] : [];
  const concentrationRisk = Math.min(100, Math.round(top10Pct * 0.85 + Math.max(0, top25Pct - 60) * 0.55 + Math.max(0, whalePct - burnPct) * 0.35));
  return {
    tokenAddress,
    holders,
    totalHolders,
    sampledHolderCount: holders.length,
    top10Pct,
    top25Pct,
    top50Pct,
    whalePct,
    lpPct,
    contractPct,
    burnPct,
    retailPct,
    deployerPct,
    topHolder,
    actionableSignals: buildHolderSignals({ top10Pct, top25Pct, top50Pct, whalePct, lpPct, contractPct, burnPct, deployerPct, totalHolders, sampledHolderCount: holders.length, topHolder }),
    concentrationRisk,
    dataQuality: createDataQuality({
      source,
      sourcesTried: source === "Blockscout" ? ["Blockscout"] : ["Blockscout", "BaseRPC"],
      confidence,
      isPartial: confidence !== "high" || consistencyWarnings.length > 0 || (totalHolders !== undefined && holders.length < totalHolders),
      missingFields: holders.length ? [] : ["holders"],
      warnings: [...warnings, ...consistencyWarnings]
    })
  };
}

function emptyDistribution(tokenAddress: string, source: string, warnings: string[]): HolderDistribution {
  return {
    tokenAddress,
    holders: [],
    sampledHolderCount: 0,
    actionableSignals: ["Holder data unavailable. Treat holder metrics as unknown until an indexer responds."],
    concentrationRisk: 50,
    dataQuality: createDataQuality({ source, confidence: "low", isPartial: true, missingFields: ["holders"], warnings })
  };
}

function classifyHolder(address: string, isContract: boolean, pct?: number, label = ""): TokenHolder["category"] {
  const lower = address.toLowerCase();
  const text = label.toLowerCase();
  if (/^0x0{40}$/.test(lower) || lower === "0x000000000000000000000000000000000000dead" || text.includes("burn")) return "burn";
  if (text.includes("pool") || text.includes("pair") || text.includes("aerodrome") || text.includes("uniswap") || text.includes("liquidity")) return "lp";
  if (text.includes("coinbase") || text.includes("binance") || text.includes("okx") || text.includes("bybit")) return "cex";
  if (isContract) return "contract";
  if ((pct ?? 0) >= 1) return "whale";
  return "retail";
}

function readTotalHolders(tokenInfo: any, items: any[]) {
  const first = items[0];
  const count = Number(
    tokenInfo?.holders_count ??
    tokenInfo?.holders ??
    tokenInfo?.total_holders ??
    first?.token?.holders_count ??
    first?.token?.holders ??
    first?.holders_count
  );
  return Number.isFinite(count) && count > 0 ? count : undefined;
}

function readTokenSupply(tokenInfo: any) {
  const value = tokenInfo?.total_supply ?? tokenInfo?.totalSupply ?? tokenInfo?.circulating_market_cap?.total_supply;
  return value !== undefined && value !== null ? String(value) : undefined;
}

function readTokenDecimals(tokenInfo: any) {
  const value = Number(tokenInfo?.decimals ?? tokenInfo?.token?.decimals);
  return Number.isFinite(value) ? value : undefined;
}

function buildHolderSignals(input: { top10Pct: number; top25Pct: number; top50Pct: number; whalePct: number; lpPct: number; contractPct: number; burnPct: number; deployerPct: number; totalHolders?: number; sampledHolderCount: number; topHolder?: TokenHolder }) {
  const signals: string[] = [];
  if (input.top10Pct >= 75) signals.push("Top 10 holders control a very large share; exits can be vulnerable to concentrated selling.");
  else if (input.top10Pct >= 50) signals.push("Top 10 concentration is elevated; monitor whale movements before sizing aggressively.");
  else signals.push("Top 10 concentration is moderate relative to observed holder sample.");
  signals.push(input.totalHolders ? `Indexer reports ${input.totalHolders.toLocaleString()} total holders; concentration is computed from the top ${input.sampledHolderCount} sampled holders.` : `Total holder count is unavailable; concentration is computed from the top ${input.sampledHolderCount} sampled holders only.`);
  if ((input.topHolder?.ownershipPct ?? 0) >= 20 && input.topHolder?.category !== "burn") signals.push("Largest non-burn holder is above 20%; verify whether it is LP, team, or exchange custody.");
  if (input.burnPct >= 10) signals.push("Large burn/dead balance detected; do not confuse burned supply with active whale control.");
  if (input.lpPct + input.contractPct >= 20) signals.push("Large contract/LP custody bucket detected; inspect whether liquidity is locked or withdrawable.");
  if (input.totalHolders !== undefined && input.totalHolders < 500) signals.push("Holder base is still thin; early tokens can move violently on small wallet flows.");
  if (input.deployerPct >= 5) signals.push("Deployer ownership is material; monitor deployer transfers closely.");
  return signals;
}
