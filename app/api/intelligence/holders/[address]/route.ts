import { NextRequest, NextResponse } from "next/server";
import { readHolderWalletIntelligence } from "@/lib/indexer/holderWalletIndexer";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid Base token address" }, { status: 400 });
  }
  return NextResponse.json({
    intelligence: readHolderWalletIntelligence(address),
    servedAt: new Date().toISOString()
  });
}
