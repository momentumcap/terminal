import { getBlockNumber, getBaseClient } from "@/lib/onchain/client";
import { BASE_CHAIN_ID } from "@/lib/onchain/config";
import * as alchemy from "@/lib/onchain/providers/alchemy";
import * as basescan from "@/lib/onchain/providers/basescan";
import * as blockscout from "@/lib/onchain/providers/blockscout";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const warnings: string[] = [];
  let baseRpc: "ok" | "error" = "ok";
  let blockscoutStatus: "ok" | "error" = "ok";
  let latestBlock: number | null = null;

  try {
    latestBlock = Number(await getBlockNumber());
    const chainId = await getBaseClient().getChainId();
    if (chainId !== BASE_CHAIN_ID) warnings.push(`RPC returned chainId ${chainId}, expected ${BASE_CHAIN_ID}.`);
  } catch {
    baseRpc = "error";
    warnings.push("Base RPC is unavailable.");
  }

  try {
    await blockscout.getAddressInfo("0x4200000000000000000000000000000000000006");
  } catch {
    blockscoutStatus = "error";
    warnings.push("Blockscout API is unavailable.");
  }

  return NextResponse.json({
    baseRpc,
    alchemy: alchemy.isAlchemyConfigured() ? "configured" : "missing",
    basescan: basescan.isBaseScanConfigured() ? "configured" : "missing",
    blockscout: blockscoutStatus,
    latestBlock,
    chainId: BASE_CHAIN_ID,
    warnings
  }, { headers: { "Cache-Control": "no-store" } });
}
