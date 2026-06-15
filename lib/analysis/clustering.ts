import type { WalletCluster, WalletProfile } from "@/lib/analysis/types";

export function analyzeWalletClusters(wallets: WalletProfile[]): WalletCluster[] {
  const [a, b, c] = wallets;
  const deployer = wallets.find((wallet) => wallet.category === "Insider");
  const whales = wallets.filter((wallet) => wallet.category === "Whale");
  return [
    {
      id: "cluster-alpha",
      label: whales.length ? "Top-holder whale pocket" : "Observed wallet pocket",
      wallets: [whales[0]?.address ?? a?.address, whales[1]?.address ?? b?.address].filter(Boolean),
      sharedFundingSource: null,
      coordinatedTimingScore: whales.length > 1 ? 52 : 35,
      deployerLinked: false,
      insiderProbabilityScore: whales.reduce((sum, wallet) => sum + (wallet.tokenOwnershipPct ?? 0), 0) > 12 ? 48 : 28,
      sybilProbabilityScore: wallets.filter((wallet) => wallet.category === "Fresh Wallet").length > 2 ? 58 : 30,
      edges: [{ from: whales[0]?.address ?? a?.address ?? "", to: whales[1]?.address ?? b?.address ?? "", reason: "Shared top-holder cohort from holder distribution", strength: whales.length > 1 ? 52 : 30 }]
    },
    {
      id: "cluster-beta",
      label: deployer ? "Deployer proximity watch" : "Fresh/active wallet watch",
      wallets: [deployer?.address ?? c?.address, wallets[3]?.address].filter(Boolean),
      sharedFundingSource: null,
      coordinatedTimingScore: deployer ? 44 : 34,
      deployerLinked: Boolean(deployer),
      insiderProbabilityScore: deployer ? 62 : 32,
      sybilProbabilityScore: wallets.filter((wallet) => wallet.txCount !== undefined && wallet.txCount < 5).length > 1 ? 55 : 28,
      edges: [{ from: deployer?.address ?? c?.address ?? "", to: wallets[3]?.address ?? "", reason: deployer ? "Deployer included in wallet intelligence set" : "Fresh/active observed wallets grouped for monitoring", strength: deployer ? 60 : 36 }]
    }
  ];
}
