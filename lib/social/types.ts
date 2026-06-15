import type { DataQuality } from "@/lib/onchain/types";

export type SocialSource = "x" | "reddit" | "farcaster" | "mock";
export type SocialSentiment = "bullish" | "neutral" | "bearish" | "mixed";

export interface SocialPost {
  id: string;
  source: SocialSource;
  author?: string;
  authorFollowers?: number;
  text: string;
  url?: string;
  createdAt: string;
  engagement: {
    likes?: number;
    reposts?: number;
    replies?: number;
    quotes?: number;
  };
}

export interface SocialMomentumAnalysis {
  tokenAddress: string;
  symbol: string;
  name: string;
  queryTerms: string[];
  mentionCount1h: number;
  mentionCount6h: number;
  mentionCount24h: number;
  uniqueAuthors24h: number;
  engagement24h: number;
  socialVelocity: number;
  mentionAcceleration: number;
  sentimentScore: number;
  sentiment: SocialSentiment;
  influencerActivityScore: number;
  communityGrowthScore: number;
  botRiskScore: number;
  narrativeStrengthScore: number;
  trendLabel: "Quiet" | "Building" | "Hot" | "Viral" | "Fading";
  topPosts: SocialPost[];
  signals: string[];
  dataQuality: DataQuality;
}
