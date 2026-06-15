import { NextRequest, NextResponse } from "next/server";
import { listWalletIntelligenceEvents } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 25);
  const tokenAddress = request.nextUrl.searchParams.get("tokenAddress") ?? undefined;
  return NextResponse.json({
    events: listWalletIntelligenceEvents(Number.isFinite(limit) ? limit : 25, tokenAddress),
    servedAt: new Date().toISOString()
  });
}
