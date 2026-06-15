import { z } from "zod";
import { onchainConfig, normalizeAddress } from "@/lib/onchain/config";
import { withProviderGuard } from "@/lib/onchain/rateLimit";

const AnyRecord = z.object({}).passthrough();

function blockscoutUrl(path: string) {
  return `${onchainConfig.blockscoutBaseApiUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

async function blockscoutFetch(path: string) {
  return withProviderGuard("blockscout", async () => {
    const response = await fetch(blockscoutUrl(path), { cache: "no-store", headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`Blockscout ${response.status}`);
    return AnyRecord.passthrough().parse(await response.json());
  }, { concurrency: 3, timeoutMs: 12_000 });
}

export async function getAddressInfo(address: string) {
  return blockscoutFetch(`/api/v2/addresses/${normalizeAddress(address)}`);
}

export async function getTokenInfo(address: string) {
  return blockscoutFetch(`/api/v2/tokens/${normalizeAddress(address)}`);
}

export async function getTokenHolders(address: string) {
  const data = await blockscoutFetch(`/api/v2/tokens/${normalizeAddress(address)}/holders`);
  return Array.isArray(data.items) ? data.items : [];
}

export async function getTokenTransfers(address: string) {
  const data = await blockscoutFetch(`/api/v2/tokens/${normalizeAddress(address)}/transfers`);
  return Array.isArray(data.items) ? data.items : [];
}

export async function getTransactions(address: string) {
  const data = await blockscoutFetch(`/api/v2/addresses/${normalizeAddress(address)}/transactions`);
  return Array.isArray(data.items) ? data.items : [];
}

export async function getContractSource(address: string) {
  try {
    return await blockscoutFetch(`/api/v2/smart-contracts/${normalizeAddress(address)}`);
  } catch {
    return null;
  }
}
