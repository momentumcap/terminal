import { NextRequest, NextResponse } from "next/server";
import { prewarmTokenAnalysisData } from "@/lib/indexer/analysisPrewarm";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid Base contract address" }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const result = await prewarmTokenAnalysisData(address, {
    lookbackBlocks: Number.isFinite(Number(body.lookbackBlocks)) ? Number(body.lookbackBlocks) : 14_400,
    runHolderIndexer: body.runHolderIndexer !== false
  });
  return NextResponse.json({ result, servedAt: new Date().toISOString() });
}
