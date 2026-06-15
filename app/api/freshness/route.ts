import { getFreshnessServiceStatus, runFreshnessWarmup, startFreshnessService, stopFreshnessService } from "@/lib/indexer/freshnessService";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    freshness: getFreshnessServiceStatus(),
    servedAt: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "start");
  if (action === "run") {
    const freshness = await runFreshnessWarmup({
      marketLimit: Number.isFinite(Number(body.marketLimit)) ? Number(body.marketLimit) : undefined
    });
    return NextResponse.json({ freshness, servedAt: new Date().toISOString() });
  }
  const freshness = startFreshnessService({
    intervalMs: Number.isFinite(Number(body.intervalMs)) ? Number(body.intervalMs) : 30_000,
    marketLimit: Number.isFinite(Number(body.marketLimit)) ? Number(body.marketLimit) : 10
  });
  return NextResponse.json({ freshness, servedAt: new Date().toISOString() });
}

export async function DELETE() {
  return NextResponse.json({
    freshness: stopFreshnessService(),
    servedAt: new Date().toISOString()
  });
}
