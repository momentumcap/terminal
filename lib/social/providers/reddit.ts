import { socialConfig } from "@/lib/social/config";
import type { SocialPost } from "@/lib/social/types";

export async function fetchRedditPosts(queryTerms: string[]): Promise<SocialPost[]> {
  const query = encodeURIComponent(queryTerms.slice(0, 3).join(" OR "));
  const response = await fetch(`https://www.reddit.com/search.json?q=${query}&sort=new&t=day&limit=20`, {
    cache: "no-store",
    headers: { "user-agent": socialConfig.redditUserAgent }
  });
  if (!response.ok) throw new Error(`Reddit search ${response.status}`);
  const payload = await response.json();
  return (payload.data?.children ?? []).map((child: any) => {
    const item = child.data ?? {};
    return {
      id: String(item.id),
      source: "reddit" as const,
      author: item.author,
      text: String(`${item.title ?? ""} ${item.selftext ?? ""}`).trim(),
      url: item.permalink ? `https://www.reddit.com${item.permalink}` : undefined,
      createdAt: item.created_utc ? new Date(item.created_utc * 1000).toISOString() : new Date().toISOString(),
      engagement: {
        likes: Number(item.ups ?? 0),
        replies: Number(item.num_comments ?? 0)
      }
    };
  });
}
