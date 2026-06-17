import { clamp, safe } from "@/lib/analysis/scoring";
import type { SmartMoneyMetrics } from "@/lib/analysis/types";
import type { HolderIntelligenceSummary } from "@/lib/db/repository";
import { getWalletProfile } from "@/lib/onchain";
import type { DeployerProfile, HolderDistribution, RecentTokenEvent } from "@/lib/onchain/types";
import type { TokenWithScores } from "@/lib/types";

export function analyzeSmartMoney(token: TokenWithScores): SmartMoneyMetrics {
  const buyPressure = ((token.buySellImbalance ?? 0) + 1) * 50;
  const whaleBuys = Math.round(safe(token.txns1hBuys) * 0.06 + safe(token.txns5mBuys) * 0.14);
  const recurringAccumulators = Math.max(1, Math.round(whaleBuys * 0.34));
  const smartMoneyInflow = clamp(buyPressure * 0.52 + safe(token.volume1h) / Math.max(safe(token.liquidityUsd), 1) * 58);
  const WhaleAccumulationScore = clamp(whaleBuys * 4 + buyPressure * 0.55);
  const WalletConvictionScore = 50;
  const walletQualityScore = 50;
  const profitableWalletParticipation = 50;

  return {
    whaleBuys,
    whaleBuysIsEstimate: true,
    recurringAccumulators,
    profitableWalletParticipation,
    walletQualityScore,
    smartMoneyInflow,
    SmartMoneyScore: clamp(walletQualityScore * 0.3 + WhaleAccumulationScore * 0.25 + profitableWalletParticipation * 0.24 + smartMoneyInflow * 0.21),
    WhaleAccumulationScore,
    WalletConvictionScore,
    onchainWalletsAvailable: false,
    walletSignals: [
      "No verified onchain wallet cohort is available for this token yet.",
      "Whale buy count is estimated from provider buy/sell flow only.",
      "Wallet quality, conviction, and profitable participation are held neutral until holder/deployer wallets are observed."
    ],
    largeTransferCount: 0,
    deployerActivityDetected: false,
    wallets: []
  };
}

export async function enhanceSmartMoneyWithOnchain(
  base: SmartMoneyMetrics,
  token: TokenWithScores,
  holders: HolderDistribution | null,
  deployer: DeployerProfile | null,
  events: RecentTokenEvent[],
  holderWalletIntelligence?: HolderIntelligenceSummary
): Promise<SmartMoneyMetrics> {
  const eventWallets = events
    .map((event) => event.wallet)
    .filter((wallet): wallet is string => typeof wallet === "string" && !isBurnAddress(wallet));
  const candidateAddresses = uniqueAddresses([
    ...(deployer?.deployer ? [deployer.deployer] : []),
    ...(holders?.holders ?? [])
      .filter((holder) => !isBurnAddress(holder.address))
      .filter((holder) => holder.category !== "lp")
      .slice(0, 8)
      .map((holder) => holder.address),
    ...(holderWalletIntelligence?.largestObservedWallets ?? [])
      .filter((wallet) => !isBurnAddress(wallet.address))
      .slice(0, 8)
      .map((wallet) => wallet.address),
    ...eventWallets.slice(0, 8)
  ]).slice(0, 8);
  if (!candidateAddresses.length) return base;

  const profiles = await Promise.all(candidateAddresses.map((address) => getWalletProfileWithTimeout(address, 550)));
  const profileMap = new Map(profiles.filter(Boolean).map((profile) => [profile!.address, profile!]));
  const price = safe(token.priceUsd);
  const largeTransferCount = events.filter((event) => event.type === "large_transfer").length;
  const deployerActivityDetected = Boolean(deployer?.deployer && events.some((event) => event.wallet?.toLowerCase() === deployer.deployer?.toLowerCase()));

  const wallets = candidateAddresses.map((address, index) => {
    const holder = holders?.holders.find((item) => item.address.toLowerCase() === address.toLowerCase());
    const observedWallet = holderWalletIntelligence?.largestObservedWallets.find((item) => item.address.toLowerCase() === address.toLowerCase());
    const profile = profileMap.get(address);
    const ownership = holder?.ownershipPct ?? 0;
    const category = classifyAnalysisWallet(address, holder?.category, profile?.category, deployer?.deployer, observedWallet?.direction);
    const qualityScore = walletQuality({ ownership, profileCategory: profile?.category, riskFlags: profile?.riskFlags ?? [], txCount: profile?.txCount, isDeployer: address === deployer?.deployer });
    const convictionScore = clamp(qualityScore * 0.58 + Math.min(ownership * 12, 36) + (profile?.ethBalance ? Math.log10(Math.max(profile.ethBalance, 0.001)) * 6 : 0));
    return {
      address,
      label: labelWallet(category, index, holder?.label),
      category,
      balanceUsd: holder?.balanceFormatted && price ? holder.balanceFormatted * price : profile?.ethBalance ? profile.ethBalance * 2500 : 0,
      pnlEstimate: 0,
      firstSeen: profile?.firstSeen ?? (observedWallet ? `block ${observedWallet.firstSeenBlock}` : new Date().toISOString()),
      lastAction: profile?.recentActivity?.[0]?.type ? `Recent ${profile.recentActivity[0].type}` : ownership ? `${ownership.toFixed(2)}% holder` : observedWallet ? `Observed ${observedWallet.direction} flow` : "Observed onchain",
      convictionScore,
      qualityScore,
      ethBalance: profile?.ethBalance,
      tokenBalance: holder?.balanceFormatted,
      tokenOwnershipPct: ownership,
      txCount: profile?.txCount,
      labels: profile?.labels,
      riskFlags: profile?.riskFlags,
      recentActivity: profile?.recentActivity,
      dataSource: profile?.dataQuality.source ?? holders?.dataQuality.source ?? (observedWallet ? "local-holder-indexer" : "BaseRPC/Events"),
      dataConfidence: profile?.dataQuality.confidence ?? holders?.dataQuality.confidence ?? (observedWallet ? "medium" : "low")
    };
  });

  const walletQualityScore = wallets.length ? clamp(wallets.reduce((sum, wallet) => sum + wallet.qualityScore, 0) / wallets.length) : base.walletQualityScore;
  const whaleBuys = Math.max(base.whaleBuys, largeTransferCount);
  const WhaleAccumulationScore = clamp(base.WhaleAccumulationScore * 0.55 + wallets.filter((wallet) => wallet.category === "Whale").length * 14 + largeTransferCount * 6);
  const WalletConvictionScore = wallets.length ? clamp(wallets.reduce((sum, wallet) => sum + wallet.convictionScore, 0) / wallets.length) : base.WalletConvictionScore;
  const profitableWalletParticipation = clamp(base.profitableWalletParticipation * 0.55 + walletQualityScore * 0.45);
  const smartMoneyInflow = clamp(base.smartMoneyInflow * 0.6 + wallets.filter((wallet) => wallet.category === "Smart Money" || wallet.category === "Whale").length * 8 + largeTransferCount * 4);

  return {
    ...base,
    whaleBuys,
    whaleBuysIsEstimate: true,
    recurringAccumulators: Math.max(base.recurringAccumulators, wallets.filter((wallet) => wallet.convictionScore > 70).length),
    profitableWalletParticipation,
    walletQualityScore,
    smartMoneyInflow,
    SmartMoneyScore: clamp(walletQualityScore * 0.3 + WhaleAccumulationScore * 0.25 + profitableWalletParticipation * 0.24 + smartMoneyInflow * 0.21),
    WhaleAccumulationScore,
    WalletConvictionScore,
    onchainWalletsAvailable: true,
    largeTransferCount,
    deployerActivityDetected,
    walletSignals: [
      `${wallets.length} top holder/deployer wallets profiled`,
      `${largeTransferCount} large transfer events observed`,
      deployerActivityDetected ? "Deployer wallet appeared in recent token events" : "No recent deployer movement detected",
      holders ? `Holder data confidence: ${holders.dataQuality.confidence}` : holderWalletIntelligence?.indexedWalletCount ? `Wallets sourced from ${holderWalletIntelligence.indexedWalletCount} locally observed wallets` : "Wallets sourced from deployer/recent event evidence because holder distribution was unavailable"
    ],
    wallets
  };
}

async function getWalletProfileWithTimeout(address: string, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      getWalletProfile(address).catch(() => null),
      new Promise<Awaited<ReturnType<typeof getWalletProfile>> | null>((resolve) => {
        timeout = setTimeout(() => resolve(null), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function uniqueAddresses(addresses: string[]) {
  const seen = new Set<string>();
  return addresses.filter((address) => {
    const key = address.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isBurnAddress(address: string) {
  return /^0x0{40}$/.test(address) || address.toLowerCase() === "0x000000000000000000000000000000000000dead";
}

function classifyAnalysisWallet(address: string, holderCategory?: string, profileCategory?: string, deployer?: string, observedDirection?: string): import("@/lib/analysis/types").WalletCategory {
  if (deployer && address.toLowerCase() === deployer.toLowerCase()) return "Insider";
  if (holderCategory === "whale" || (profileCategory ?? "").includes("whale")) return "Whale";
  if ((profileCategory ?? "").includes("fresh")) return "Fresh Wallet";
  if (holderCategory === "contract" || (profileCategory ?? "").includes("contract")) return "Market Maker";
  if (observedDirection === "accumulating") return "Smart Money";
  if ((profileCategory ?? "").includes("active")) return "Smart Money";
  return "Retail";
}

function walletQuality(input: { ownership: number; profileCategory?: string; riskFlags: string[]; txCount?: number; isDeployer: boolean }) {
  return clamp(
    45 +
    Math.min(input.ownership * 8, 28) +
    ((input.txCount ?? 0) > 100 ? 12 : (input.txCount ?? 0) > 20 ? 6 : 0) +
    ((input.profileCategory ?? "").includes("whale") ? 10 : 0) -
    input.riskFlags.length * 6 -
    (input.isDeployer ? 4 : 0)
  );
}

function labelWallet(category: import("@/lib/analysis/types").WalletCategory, index: number, label?: string) {
  if (label) return label;
  if (category === "Insider") return "Deployer / insider wallet";
  if (category === "Whale") return `Top whale holder ${index + 1}`;
  if (category === "Smart Money") return `Active Base wallet ${index + 1}`;
  if (category === "Fresh Wallet") return `Fresh holder ${index + 1}`;
  if (category === "Market Maker") return `Contract / LP-like holder ${index + 1}`;
  return `Observed holder ${index + 1}`;
}
