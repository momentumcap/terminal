import { socialConfig } from "@/lib/social/config";
import type { SocialPost } from "@/lib/social/types";

export async function fetchXRecentPosts(queryTerms: string[]): Promise<SocialPost[]> {
  if (!socialConfig.xBearerToken) throw new Error("X bearer token missing");
  const query = buildXQuery(queryTerms);
  const url = new URL("https://api.x.com/2/tweets/search/recent");
  url.searchParams.set("query", query);
  url.searchParams.set("max_results", "25");
  url.searchParams.set("tweet.fields", "created_at,public_metrics,author_id");
  url.searchParams.set("expansions", "author_id");
  url.searchParams.set("user.fields", "username,public_metrics");

  const response = await fetch(url, {
    cache: "no-store",
    headers: { authorization: `Bearer ${socialConfig.xBearerToken}` }
  });
  if (!response.ok) throw new Error(`X recent search ${response.status}`);
  const payload = await response.json();
  const users = new Map<string, any>((payload.includes?.users ?? []).map((user: any) => [user.id, user]));
  return (payload.data ?? []).map((tweet: any) => {
    const user = users.get(tweet.author_id);
    return {
      id: String(tweet.id),
      source: "x" as const,
      author: user?.username ? `@${user.username}` : tweet.author_id,
      authorFollowers: Number(user?.public_metrics?.followers_count ?? 0),
      text: String(tweet.text ?? ""),
      url: user?.username ? `https://x.com/${user.username}/status/${tweet.id}` : undefined,
      createdAt: tweet.created_at ?? new Date().toISOString(),
      engagement: {
        likes: Number(tweet.public_metrics?.like_count ?? 0),
        reposts: Number(tweet.public_metrics?.retweet_count ?? 0),
        replies: Number(tweet.public_metrics?.reply_count ?? 0),
        quotes: Number(tweet.public_metrics?.quote_count ?? 0)
      }
    };
  });
}

function buildXQuery(queryTerms: string[]) {
  const safeTerms = queryTerms.map((term) => term.trim()).filter(Boolean).slice(0, 4);
  const body = safeTerms.map((term) => term.startsWith("$") ? `"${term}"` : term).join(" OR ");
  return `(${body}) lang:en -is:retweet`;
}
