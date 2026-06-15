import { normalizeDexScreenerPair } from "@/lib/normalize";
import type { TokenSnapshot } from "@/lib/types";

const BASE_URL = process.env.DEXSCREENER_BASE_URL ?? "https://api.dexscreener.com/latest/dex";

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json" }
  });
  if (!response.ok) throw new Error(`DexScreener ${response.status}: ${response.statusText}`);
  return response.json() as Promise<T>;
}

export async function searchDexScreener(query: string): Promise<TokenSnapshot[]> {
  if (!query.trim()) return [];
  try {
    const data = await getJson<{ pairs?: any[] }>(`${BASE_URL}/search?q=${encodeURIComponent(query)}`);
    return (data.pairs ?? [])
      .filter((pair) => pair.chainId === "base")
      .map(normalizeDexScreenerPair);
  } catch {
    return [];
  }
}

export async function fetchDexToken(address: string): Promise<TokenSnapshot[]> {
  try {
    const data = await getJson<{ pairs?: any[] }>(`${BASE_URL}/tokens/${address}`);
    const needle = address.toLowerCase();
    return (data.pairs ?? [])
      .filter((pair) => pair.chainId === "base")
      .map(normalizeDexScreenerPair)
      .filter((token) => token.tokenAddress.toLowerCase() === needle);
  } catch {
    return [];
  }
}
