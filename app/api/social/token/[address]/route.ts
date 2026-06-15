import { getSocialMomentum } from "@/lib/social";
import { fetchBestTokenMarketData } from "@/lib/marketData";
import { isBaseAddress } from "@/lib/onchain/config";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isBaseAddress(address)) return NextResponse.json({ error: "Invalid Base token address" }, { status: 400 });
  const token = (await fetchBestTokenMarketData(address).catch(() => []))[0];
  const social = await getSocialMomentum({
    tokenAddress: address,
    symbol: token?.symbol ?? "UNKNOWN",
    name: token?.name ?? address,
    volume24h: token?.volume24h,
    priceChange1h: token?.priceChange1h,
    priceChange24h: token?.priceChange24h
  });
  return NextResponse.json(social, { headers: { "Cache-Control": "no-store" } });
}
