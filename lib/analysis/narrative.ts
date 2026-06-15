import { clamp, safe } from "@/lib/analysis/scoring";
import type { NarrativeCategory, NarrativeMetrics } from "@/lib/analysis/types";
import type { SocialMomentumAnalysis } from "@/lib/social/types";
import type { TokenWithScores } from "@/lib/types";

export function analyzeNarrative(token: TokenWithScores, socialMomentum?: SocialMomentumAnalysis): NarrativeMetrics {
  const text = `${token.symbol} ${token.name}`.toLowerCase();
  const category: NarrativeCategory = text.includes("ai") || text.includes("virtual") ? "AI" : text.includes("game") ? "gaming" : text.includes("finance") || text.includes("defi") ? "DeFi" : text.includes("cat") || text.includes("brett") ? "meme" : "Base ecosystem";
  const socialVelocity = socialMomentum?.socialVelocity ?? clamp(45 + safe(token.priceChange1h) * 0.8 + safe(token.volume1h) / Math.max(safe(token.volume24h), 1) * 210);
  const mentionAcceleration = socialMomentum?.mentionAcceleration ?? clamp(40 + safe(token.priceChange5m) * 1.4 + (token.ageHours !== null && token.ageHours < 24 ? 12 : 0));
  const communityGrowth = socialMomentum?.communityGrowthScore ?? clamp(42 + Math.log10(Math.max(safe(token.volume24h), 1)) * 6);
  const narrativeMomentum = socialMomentum?.narrativeStrengthScore ?? clamp(socialVelocity * 0.38 + mentionAcceleration * 0.32 + communityGrowth * 0.3);
  return {
    category,
    socialVelocity,
    mentionAcceleration,
    communityGrowth,
    narrativeMomentum,
    NarrativeStrengthScore: narrativeMomentum,
    socialMomentum,
    signals: [`${category} narrative classification`, ...(socialMomentum?.signals ?? ["Social adapters are placeholder-ready"]), token.ageHours !== null && token.ageHours < 24 ? "Fresh-pool attention cycle active" : "Established attention baseline"]
  };
}
