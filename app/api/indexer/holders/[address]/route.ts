import { NextRequest, NextResponse } from "next/server";
import { indexTokenHolderWallets } from "@/lib/indexer/holderWalletIndexer";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid Base token address" }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const lookbackBlocks = Number(body.lookbackBlocks ?? 14_400);
  const fromBlock = body.fromBlock === undefined ? undefined : Number(body.fromBlock);
  const toBlock = body.toBlock === undefined ? undefined : Number(body.toBlock);
  const result = await indexTokenHolderWallets(address, {
    lookbackBlocks: Number.isFinite(lookbackBlocks) ? lookbackBlocks : 14_400,
    fromBlock: Number.isFinite(fromBlock) ? fromBlock : undefined,
    toBlock: Number.isFinite(toBlock) ? toBlock : undefined
  });
  return NextResponse.json({ result, servedAt: new Date().toISOString() });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid Base token address" }, { status: 400 });
  }
  const result = await indexTokenHolderWallets(address, { lookbackBlocks: 3_600 });
  return NextResponse.json({ result, servedAt: new Date().toISOString() });
}
