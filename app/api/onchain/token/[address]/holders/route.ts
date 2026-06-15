import { getTokenHolders } from "@/lib/onchain";
import { isBaseAddress } from "@/lib/onchain/config";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  if (!isBaseAddress(address)) return NextResponse.json({ error: "Invalid Base token address" }, { status: 400 });
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 50);
  const mode = request.nextUrl.searchParams.get("mode") as "auto" | "indexer" | "rpc" | null;
  return NextResponse.json(await getTokenHolders(address, { limit, mode: mode ?? "auto" }), { headers: { "Cache-Control": "no-store" } });
}
