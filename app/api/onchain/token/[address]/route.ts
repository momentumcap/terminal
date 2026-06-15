import { getTokenOnchainProfile } from "@/lib/onchain";
import { isBaseAddress } from "@/lib/onchain/config";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isBaseAddress(address)) return NextResponse.json({ error: "Invalid Base token address" }, { status: 400 });
  const profile = await getTokenOnchainProfile(address);
  return NextResponse.json(profile, { headers: { "Cache-Control": "no-store" } });
}
