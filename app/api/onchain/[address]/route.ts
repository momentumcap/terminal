import { REALTIME_HEADERS, realtimeJson } from "@/lib/apiResponse";
import { CACHE_TTLS } from "@/lib/freshness";
import { getOwnOnchainSnapshot } from "@/lib/onchain/snapshot";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  try {
    const { address } = await params;
    const { searchParams } = new URL(_request.url);
    const pairs = searchParams.get("pairs")?.split(",").map((pair) => pair.trim()).filter(Boolean);
    const snapshot = await getOwnOnchainSnapshot(address, pairs?.length ? pairs : searchParams.get("pair") ?? undefined);
    return realtimeJson({ refreshSeconds: CACHE_TTLS.ownOnchainMs / 1000, ...snapshot });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to build Base RPC onchain snapshot",
        detail: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 502, headers: REALTIME_HEADERS }
    );
  }
}
