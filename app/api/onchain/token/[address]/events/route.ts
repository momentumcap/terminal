import { getRecentTokenEvents } from "@/lib/onchain";
import { eventsDataQuality } from "@/lib/onchain/events";
import { isBaseAddress } from "@/lib/onchain/config";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isBaseAddress(address)) return NextResponse.json({ error: "Invalid Base token address" }, { status: 400 });
  const events = await getRecentTokenEvents(address);
  return NextResponse.json({ events, dataQuality: eventsDataQuality(events.length) }, { headers: { "Cache-Control": "no-store" } });
}
