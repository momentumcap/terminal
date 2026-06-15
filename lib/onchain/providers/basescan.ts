import { z } from "zod";
import { BASE_CHAIN_ID, onchainConfig, normalizeAddress } from "@/lib/onchain/config";
import { withProviderGuard } from "@/lib/onchain/rateLimit";

const EtherscanEnvelope = z.object({
  status: z.string().optional(),
  message: z.string().optional(),
  result: z.unknown()
});

const BASE_URL = "https://api.etherscan.io/v2/api";

export function isBaseScanConfigured() {
  return Boolean(onchainConfig.basescanApiKey);
}

export async function basescanRequest(params: Record<string, string | number | undefined>) {
  if (!isBaseScanConfigured()) throw new Error("BaseScan/Etherscan V2 API key missing");
  const url = new URL(BASE_URL);
  url.searchParams.set("chainid", String(BASE_CHAIN_ID));
  url.searchParams.set("apikey", onchainConfig.basescanApiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return withProviderGuard("basescan", async () => {
    const response = await fetch(url, { cache: "no-store", headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`BaseScan ${response.status}`);
    const parsed = EtherscanEnvelope.parse(await response.json());
    if (typeof parsed.result === "string" && /invalid|missing|error/i.test(parsed.result)) throw new Error(parsed.result);
    return parsed.result;
  }, { concurrency: 2, timeoutMs: 15_000 });
}

export async function getContractSource(address: string) {
  const result = await basescanRequest({ module: "contract", action: "getsourcecode", address: normalizeAddress(address) });
  return Array.isArray(result) ? result[0] : null;
}

export async function getTokenTransfers(address: string, startblock = 0, endblock = 99999999, page = 1, offset = 100) {
  const result = await basescanRequest({ module: "account", action: "tokentx", contractaddress: normalizeAddress(address), startblock, endblock, page, offset, sort: "desc" });
  return Array.isArray(result) ? result : [];
}

export async function getNormalTransactions(address: string, page = 1, offset = 25) {
  const result = await basescanRequest({ module: "account", action: "txlist", address: normalizeAddress(address), page, offset, sort: "desc" });
  return Array.isArray(result) ? result : [];
}

export async function getInternalTransactions(address: string, page = 1, offset = 25) {
  const result = await basescanRequest({ module: "account", action: "txlistinternal", address: normalizeAddress(address), page, offset, sort: "desc" });
  return Array.isArray(result) ? result : [];
}

export async function getContractCreation(address: string) {
  const result = await basescanRequest({ module: "contract", action: "getcontractcreation", contractaddresses: normalizeAddress(address) });
  return Array.isArray(result) ? result[0] : null;
}

export async function getTokenInfo(address: string) {
  const source = await getContractSource(address);
  return source ? { source } : null;
}
