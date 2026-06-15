import { formatUnits } from "viem";
import { normalizeAddress } from "@/lib/onchain/config";

export function toOptionalNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function rawToFormatted(balanceRaw: string | bigint | undefined, decimals?: number): number | undefined {
  if (balanceRaw === undefined || decimals === undefined) return undefined;
  try {
    return Number(formatUnits(BigInt(balanceRaw), decimals));
  } catch {
    return undefined;
  }
}

export function addressOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value) ? normalizeAddress(value) : undefined;
}
