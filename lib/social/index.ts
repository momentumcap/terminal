import { createDataQuality } from "@/lib/onchain/config";
import { withCache } from "@/lib/storage";
import { fetchXRecentPosts } from "@/lib/social/providers/x";
import { fetchRedditPosts } from "@/lib/social/providers/reddit";
import { clamp, postEngagement, scoreSentiment, socialTrendLabel } from "@/lib/social/scoring";
import type { SocialMomentumAnalysis, SocialPost } from "@/lib/social/types";

interface SocialInput {
  tokenAddress: string;
  symbol: string;
  name: string;
  volume24h?: number | null;
  priceChange1h?: number | null;
  priceChange24h?: number | null;
}

export async function getSocialMomentum(input: SocialInput): Promise<SocialMomentumAnalysis> {
  const queryTerms = buildQueryTerms(input);
  return withCache(`social:${input.tokenAddress.toLowerCase()}:${queryTerms.join("|")}`, 60_000, async () => {
    const sourcesTried: string[] = [];
    const warnings: string[] = [];
    const posts: SocialPost[] = [];

    try {
      sourcesTried.push("x");
      posts.push(...await fetchXRecentPosts(queryTerms));
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "X social adapter unavailable.");
    }

    try {
      sourcesTried.push("reddit");
      posts.push(...await fetchRedditPosts(queryTerms));
    } catch {
      warnings.push("Reddit social adapter unavailable.");
    }

    const deduped = dedupePosts(posts);
    if (!deduped.length) return mockSocialMomentum(input, queryTerms, sourcesTried, warnings);
    return scoreSocialPosts(input, queryTerms, deduped, sourcesTried, warnings);
  });
}

function scoreSocialPosts(input: SocialInput, queryTerms: string[], posts: SocialPost[], sourcesTried: string[], warnings: string[]): SocialMomentumAnalysis {
  const now = Date.now();
  const ageHours = (post: SocialPost) => Math.max(0, (now - new Date(post.createdAt).getTime()) / 36e5);
  const mentionCount1h = posts.filter((post) => ageHours(post) <= 1).length;
  const mentionCount6h = posts.filter((post) => ageHours(post) <= 6).length;
  const mentionCount24h = posts.filter((post) => ageHours(post) <= 24).length;
  const uniqueAuthors24h = new Set(posts.filter((post) => ageHours(post) <= 24).map((post) => post.author ?? post.id)).size;
  const engagement24h = posts.filter((post) => ageHours(post) <= 24).reduce((sum, post) => sum + postEngagement(post), 0);
  const socialVelocity = clamp(mentionCount1h * 16 + mentionCount6h * 4 + Math.log10(Math.max(engagement24h, 1)) * 16);
  const mentionAcceleration = clamp(mentionCount6h ? (mentionCount1h * 6 / mentionCount6h) * 55 : mentionCount1h ? 70 : 20);
  const influencerActivityScore = clamp(posts.reduce((sum, post) => sum + Math.log10(Math.max(post.authorFollowers ?? 0, 1)) * 3, 0));
  const communityGrowthScore = clamp(uniqueAuthors24h * 6 + mentionCount24h * 1.5);
  const botRiskScore = clamp(100 - (uniqueAuthors24h / Math.max(mentionCount24h, 1)) * 100 + (mentionCount24h > 10 && uniqueAuthors24h < 4 ? 28 : 0));
  const { sentimentScore, sentiment } = scoreSentiment(posts);
  const narrativeStrengthScore = clamp(socialVelocity * 0.34 + mentionAcceleration * 0.24 + influencerActivityScore * 0.16 + communityGrowthScore * 0.16 + sentimentScore * 0.1 - botRiskScore * 0.16);
  const trendLabel = socialTrendLabel(narrativeStrengthScore, mentionAcceleration);

  return {
    tokenAddress: input.tokenAddress.toLowerCase(),
    symbol: input.symbol,
    name: input.name,
    queryTerms,
    mentionCount1h,
    mentionCount6h,
    mentionCount24h,
    uniqueAuthors24h,
    engagement24h,
    socialVelocity,
    mentionAcceleration,
    sentimentScore,
    sentiment,
    influencerActivityScore,
    communityGrowthScore,
    botRiskScore,
    narrativeStrengthScore,
    trendLabel,
    topPosts: posts.sort((a, b) => postEngagement(b) - postEngagement(a)).slice(0, 5),
    signals: buildSignals(trendLabel, sentiment, botRiskScore, sourcesTried),
    dataQuality: createDataQuality({ source: sourcesTried.join(" + "), sourcesTried, confidence: sourcesTried.includes("x") && !warnings.some((warning) => warning.includes("X")) ? "medium" : "low", isPartial: warnings.length > 0, missingFields: warnings.length ? ["completeSocialCoverage"] : [], warnings })
  };
}

function mockSocialMomentum(input: SocialInput, queryTerms: string[], sourcesTried: string[], warnings: string[]): SocialMomentumAnalysis {
  const volumeSignal = Math.log10(Math.max(Number(input.volume24h ?? 1), 1));
  const changeSignal = Math.max(Number(input.priceChange24h ?? 0), 0);
  const socialVelocity = clamp(28 + volumeSignal * 7 + changeSignal * 0.35);
  const mentionAcceleration = clamp(24 + Math.max(Number(input.priceChange1h ?? 0), 0) * 1.8);
  const sentimentScore = clamp(48 + Number(input.priceChange24h ?? 0) * 0.4);
  const narrativeStrengthScore = clamp(socialVelocity * 0.45 + mentionAcceleration * 0.3 + sentimentScore * 0.25);
  return {
    tokenAddress: input.tokenAddress.toLowerCase(),
    symbol: input.symbol,
    name: input.name,
    queryTerms,
    mentionCount1h: 0,
    mentionCount6h: 0,
    mentionCount24h: 0,
    uniqueAuthors24h: 0,
    engagement24h: 0,
    socialVelocity,
    mentionAcceleration,
    sentimentScore,
    sentiment: sentimentScore > 60 ? "bullish" : sentimentScore < 40 ? "bearish" : "neutral",
    influencerActivityScore: 0,
    communityGrowthScore: 0,
    botRiskScore: 50,
    narrativeStrengthScore,
    trendLabel: socialTrendLabel(narrativeStrengthScore, mentionAcceleration),
    topPosts: [],
    signals: ["Live social adapters returned no posts; using market-derived social proxy.", "Add X bearer token for real-time mention monitoring."],
    dataQuality: createDataQuality({ source: "mock", sourcesTried, confidence: "low", isPartial: true, missingFields: ["xPosts", "redditPosts"], warnings })
  };
}

function buildQueryTerms(input: SocialInput) {
  return [...new Set([`$${input.symbol}`, input.symbol, input.name, input.tokenAddress].filter((term) => term && term !== "UNKNOWN"))].slice(0, 5);
}

function dedupePosts(posts: SocialPost[]) {
  const seen = new Set<string>();
  return posts.filter((post) => {
    const key = `${post.source}-${post.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSignals(trendLabel: string, sentiment: string, botRiskScore: number, sourcesTried: string[]) {
  return [
    `${trendLabel} social trend detected`,
    `${sentiment} social sentiment`,
    botRiskScore > 65 ? "Elevated repeated-author or low-author diversity risk" : "Author diversity acceptable for observed sample",
    `Social sources checked: ${sourcesTried.join(", ") || "none"}`
  ];
}
