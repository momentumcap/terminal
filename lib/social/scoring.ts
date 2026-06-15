import type { SocialPost, SocialSentiment } from "@/lib/social/types";

export const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

const BULLISH_WORDS = ["send", "sent", "moon", "breakout", "ape", "buy", "bull", "accumulate", "based", "gem", "runner", "alpha"];
const BEARISH_WORDS = ["rug", "scam", "dump", "sell", "honeypot", "farm", "dead", "avoid", "jeet", "warning"];

export function scoreSentiment(posts: SocialPost[]) {
  let score = 50;
  for (const post of posts) {
    const text = post.text.toLowerCase();
    score += BULLISH_WORDS.filter((word) => text.includes(word)).length * 4;
    score -= BEARISH_WORDS.filter((word) => text.includes(word)).length * 6;
  }
  const sentimentScore = clamp(score);
  const sentiment: SocialSentiment = sentimentScore >= 64 ? "bullish" : sentimentScore <= 38 ? "bearish" : posts.some((post) => BEARISH_WORDS.some((word) => post.text.toLowerCase().includes(word))) ? "mixed" : "neutral";
  return { sentimentScore, sentiment };
}

export function postEngagement(post: SocialPost) {
  return (post.engagement.likes ?? 0) + (post.engagement.reposts ?? 0) * 2 + (post.engagement.replies ?? 0) + (post.engagement.quotes ?? 0) * 2;
}

export function socialTrendLabel(score: number, acceleration: number): "Quiet" | "Building" | "Hot" | "Viral" | "Fading" {
  if (acceleration < 25 && score < 45) return "Fading";
  if (score >= 85) return "Viral";
  if (score >= 68) return "Hot";
  if (score >= 45) return "Building";
  return "Quiet";
}
