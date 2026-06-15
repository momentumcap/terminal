import { NextRequest, NextResponse } from "next/server";
import { indexTrackedHolderWallets } from "@/lib/indexer/holderWalletIndexer";
import { getIndexerCandidateTokens } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 8);
  return NextResponse.json({
    candidates: getIndexerCandidateTokens(Number.isFinite(limit) ? limit : 8),
    servedAt: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const result = await indexTrackedHolderWallets({
    addresses: Array.isArray(body.addresses) ? body.addresses : undefined,
    limit: Number.isFinite(Number(body.limit)) ? Number(body.limit) : 3,
    lookbackBlocks: Number.isFinite(Number(body.lookbackBlocks)) ? Number(body.lookbackBlocks) : 1_800
  });
  return NextResponse.json({ result, servedAt: new Date().toISOString() });
}
