import { realtimeJson } from "@/lib/apiResponse";
import { searchTokens } from "@/lib/data";
import { CACHE_TTLS } from "@/lib/freshness";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const tokens = q.trim() ? await searchTokens(q) : [];
  return realtimeJson({
    chainId: 8453,
    q,
    source: "DexScreener live public API",
    dataPolicy: "live-only-no-silent-mock-fallback",
    refreshSeconds: CACHE_TTLS.dexSearchMs / 1000,
    warnings: q.trim() && tokens.length === 0 ? ["No live Base search results were returned by DexScreener. Mock data is intentionally hidden for accuracy."] : [],
    tokens
  });
}
