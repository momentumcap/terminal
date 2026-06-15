import { ethCall, normalizeAddress, strip0x } from "@/lib/onchain/baseRpc";
import { BASE_CHAIN_ID, createDataQuality } from "@/lib/onchain/config";
import { erc20Abi, multicall } from "@/lib/onchain/client";
import type { OnchainTokenProfile } from "@/lib/onchain/types";

const SELECTORS = {
  symbol: "0x95d89b41",
  name: "0x06fdde03",
  decimals: "0x313ce567",
  totalSupply: "0x18160ddd"
};

export interface OnchainTokenMetadata {
  address: string;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  totalSupply: string | null;
}

export async function getOnchainTokenMetadata(address: string): Promise<OnchainTokenMetadata> {
  const [symbol, name, decimals, totalSupply] = await Promise.all([
    safeCallString(address, SELECTORS.symbol),
    safeCallString(address, SELECTORS.name),
    safeCallUint(address, SELECTORS.decimals),
    safeCallUint(address, SELECTORS.totalSupply)
  ]);

  return {
    address: normalizeAddress(address),
    symbol,
    name,
    decimals: decimals === null ? null : Number(decimals),
    totalSupply: totalSupply?.toString() ?? null
  };
}

export async function getERC20Metadata(address: string): Promise<OnchainTokenProfile> {
  const normalized = normalizeAddress(address);
  const calls = ["name", "symbol", "decimals", "totalSupply", "owner", "getOwner"].map((functionName) => ({
    address: normalized,
    abi: erc20Abi,
    functionName
  }));
  const results = await multicall(calls);
  const value = <T>(index: number): T | undefined => results[index]?.status === "success" ? results[index].result as T : undefined;
  const owner = value<string>(4) ?? value<string>(5);
  const missingFields = [
    !value<string>(0) ? "name" : "",
    !value<string>(1) ? "symbol" : "",
    value<number>(2) === undefined ? "decimals" : "",
    value<bigint>(3) === undefined ? "totalSupply" : "",
    !owner ? "owner" : ""
  ].filter(Boolean);

  return {
    chainId: BASE_CHAIN_ID,
    address: normalized,
    name: value<string>(0),
    symbol: value<string>(1),
    decimals: value<number>(2),
    totalSupply: value<bigint>(3)?.toString(),
    owner: owner ? normalizeAddress(owner) : undefined,
    dataQuality: createDataQuality({
      source: "BaseRPC",
      confidence: missingFields.length <= 1 ? "high" : "medium",
      isPartial: missingFields.length > 0,
      missingFields,
      warnings: missingFields.includes("owner") ? ["Owner method is not standard ERC20 and may be unavailable."] : []
    })
  };
}

async function safeCallString(address: string, selector: string): Promise<string | null> {
  try {
    const result = await ethCall(address, selector);
    return decodeStringResult(result);
  } catch {
    return null;
  }
}

async function safeCallUint(address: string, selector: string): Promise<bigint | null> {
  try {
    const result = await ethCall(address, selector);
    if (!result || result === "0x") return null;
    return BigInt(result);
  } catch {
    return null;
  }
}

function decodeStringResult(result: string): string | null {
  if (!result || result === "0x") return null;
  const data = strip0x(result);
  if (data.length === 64) return hexToAscii(data);
  const offset = Number.parseInt(data.slice(0, 64), 16);
  const length = Number.parseInt(data.slice(offset * 2, offset * 2 + 64), 16);
  const body = data.slice(offset * 2 + 64, offset * 2 + 64 + length * 2);
  return hexToAscii(body);
}

function hexToAscii(hex: string) {
  const bytes = hex.match(/.{1,2}/g) ?? [];
  const text = bytes.map((byte) => String.fromCharCode(Number.parseInt(byte, 16))).join("");
  return text.replace(/\0/g, "").trim() || null;
}
