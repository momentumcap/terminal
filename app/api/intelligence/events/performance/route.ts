import { NextResponse } from "next/server";
import { getWalletEventPerformanceSummary, listWalletEventPerformance, refreshWalletEventPerformance } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    summary: getWalletEventPerformanceSummary(),
    records: listWalletEventPerformance(50),
    servedAt: new Date().toISOString()
  });
}

export async function POST() {
  const records = refreshWalletEventPerformance(200);
  return NextResponse.json({
    summary: getWalletEventPerformanceSummary(),
    records,
    servedAt: new Date().toISOString()
  });
}
