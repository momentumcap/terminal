import { NextRequest, NextResponse } from "next/server";
import { getIndexerCandidateTokens } from "@/lib/db/repository";
import { sampleTrackedTokenMarkets } from "@/lib/indexer/marketSampler";

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
  const result = await sampleTrackedTokenMarkets({
    addresses: Array.isArray(body.addresses) ? body.addresses : undefined,
    limit: Number.isFinite(Number(body.limit)) ? Number(body.limit) : 10
  });
  return NextResponse.json({ result, servedAt: new Date().toISOString() });
}
