import { realtimeJson } from "@/lib/apiResponse";
import { listWatchlist, upsertWatchlist } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return realtimeJson({ watchlist: listWatchlist() });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.tokenAddress || !body?.symbol) {
    return NextResponse.json({ error: "tokenAddress and symbol are required" }, { status: 400 });
  }
  const entry = upsertWatchlist({ tokenAddress: body.tokenAddress, symbol: body.symbol });
  return realtimeJson({ entry, watchlist: listWatchlist() }, { status: 201 });
}
