import type { WalletProfile } from "@/lib/analysis/types";

export const seededWallets: WalletProfile[] = [
  {
    address: "0x8f1a...a912",
    label: "Base whale cohort A",
    category: "Whale",
    balanceUsd: 184000,
    pnlEstimate: 62000,
    firstSeen: "2026-05-21T12:14:00.000Z",
    lastAction: "Added on Aerodrome dip",
    convictionScore: 82,
    qualityScore: 78
  },
  {
    address: "0x61be...44ac",
    label: "Recurring accumulator",
    category: "Smart Money",
    balanceUsd: 94000,
    pnlEstimate: 41000,
    firstSeen: "2026-05-23T02:32:00.000Z",
    lastAction: "Bought 3 consecutive pullbacks",
    convictionScore: 88,
    qualityScore: 84
  },
  {
    address: "0x3df0...19bd",
    label: "Early sniper",
    category: "Sniper",
    balanceUsd: 26000,
    pnlEstimate: 17000,
    firstSeen: "2026-05-26T17:42:00.000Z",
    lastAction: "Partial exit into strength",
    convictionScore: 52,
    qualityScore: 46
  },
  {
    address: "0xa9c2...77e1",
    label: "Fresh Base wallet",
    category: "Fresh Wallet",
    balanceUsd: 8500,
    pnlEstimate: -700,
    firstSeen: "2026-05-27T08:09:00.000Z",
    lastAction: "Initial buy",
    convictionScore: 44,
    qualityScore: 35
  }
];
