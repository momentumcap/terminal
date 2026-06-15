import { realtimeJson } from "@/lib/apiResponse";
import { getTokenByAddress } from "@/lib/data";
import { CACHE_TTLS } from "@/lib/freshness";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const token = await getTokenByAddress(address);
  if (!token) return NextResponse.json({ error: "Token not found" }, { status: 404 });
  return realtimeJson({ chainId: 8453, refreshSeconds: CACHE_TTLS.dexAddressMs / 1000, token });
}
