import { NextRequest, NextResponse } from "next/server";
import { getHolderIndexerSchedulerStatus, runHolderIndexerSchedulerTick, startHolderIndexerScheduler, stopHolderIndexerScheduler } from "@/lib/indexer/scheduler";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    scheduler: getHolderIndexerSchedulerStatus(),
    servedAt: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action ?? "start");
  if (action === "tick") {
    const scheduler = await runHolderIndexerSchedulerTick();
    return NextResponse.json({ scheduler, servedAt: new Date().toISOString() });
  }
  const scheduler = startHolderIndexerScheduler({
    intervalMs: Number(body.intervalMs ?? 120_000),
    batchLimit: Number(body.batchLimit ?? 2),
    lookbackBlocks: Number(body.lookbackBlocks ?? 1_800)
  });
  return NextResponse.json({ scheduler, servedAt: new Date().toISOString() });
}

export async function DELETE() {
  return NextResponse.json({
    scheduler: stopHolderIndexerScheduler(),
    servedAt: new Date().toISOString()
  });
}
