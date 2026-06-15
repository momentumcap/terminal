import { realtimeJson } from "@/lib/apiResponse";
import { getBankrLaunch } from "@/lib/bankr";
import { CACHE_TTLS } from "@/lib/freshness";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const launch = await getBankrLaunch(address);
  if (!launch) return NextResponse.json({ error: "Bankr launch not found" }, { status: 404 });
  return realtimeJson({ refreshSeconds: CACHE_TTLS.bankrLaunchesMs / 1000, launch });
}
