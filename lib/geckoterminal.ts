import { normalizeGeckoPool } from "@/lib/normalize";
import type { TokenSnapshot } from "@/lib/types";

const BASE_URL = process.env.GECKOTERMINAL_BASE_URL ?? "https://api.geckoterminal.com/api/v2";

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json" }
  });
  if (!response.ok) throw new Error(`GeckoTerminal ${response.status}: ${response.statusText}`);
  return response.json() as Promise<T>;
}

export async function fetchTrendingBasePools(): Promise<TokenSnapshot[]> {
  try {
    const data = await getJson<{ data?: any[] }>(`${BASE_URL}/networks/base/trending_pools`);
    return (data.data ?? []).map(normalizeGeckoPool);
  } catch {
    return [];
  }
}

export async function fetchNewBasePools(): Promise<TokenSnapshot[]> {
  try {
    const data = await getJson<{ data?: any[] }>(`${BASE_URL}/networks/base/new_pools`);
    return (data.data ?? []).map(normalizeGeckoPool);
  } catch {
    return [];
  }
}

export async function fetchGeckoTokenPools(address: string): Promise<TokenSnapshot[]> {
  try {
    const data = await getJson<{ data?: any[] }>(`${BASE_URL}/networks/base/tokens/${address}/pools`);
    return (data.data ?? []).map(normalizeGeckoPool).filter((token) => token.tokenAddress.toLowerCase() === address.toLowerCase());
  } catch {
    return [];
  }
}
