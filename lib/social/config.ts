export const socialConfig = {
  xBearerToken: process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN || "",
  redditUserAgent: process.env.REDDIT_USER_AGENT || "MomentumTerminal/0.1",
  farcasterApiUrl: process.env.FARCASTER_API_URL || "",
  socialProviderMode: process.env.SOCIAL_PROVIDER_MODE || "auto"
};

export function isXConfigured() {
  return Boolean(socialConfig.xBearerToken);
}
