import { getWalletProfile } from "@/lib/onchain";
import { isBaseAddress } from "@/lib/onchain/config";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isBaseAddress(address)) return NextResponse.json({ error: "Invalid Base wallet address" }, { status: 400 });
  return NextResponse.json(await getWalletProfile(address), { headers: { "Cache-Control": "no-store" } });
}
