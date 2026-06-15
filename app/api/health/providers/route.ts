import { realtimeJson } from "@/lib/apiResponse";
import { getBaseClient, getBlockNumber } from "@/lib/onchain/client";
import { BASE_CHAIN_ID, onchainConfig } from "@/lib/onchain/config";
import * as alchemy from "@/lib/onchain/providers/alchemy";
import * as basescan from "@/lib/onchain/providers/basescan";
import * as blockscout from "@/lib/onchain/providers/blockscout";
import { persistProviderHealth } from "@/lib/db/repository";
import type { ProviderHealth } from "@/lib/trust/types";

export const dynamic = "force-dynamic";

const WETH = "0x4200000000000000000000000000000000000006";

export async function GET() {
  const checks = await Promise.all([
    checkBaseRpc(),
    checkAlchemy(),
    checkBaseScan(),
    checkBlockscout(),
    checkFetch("DexScreener", "https://api.dexscreener.com/latest/dex/search?q=WETH", true),
    checkFetch("GeckoTerminal", "https://api.geckoterminal.com/api/v2/networks/base/trending_pools", true),
    checkFetch("Bankr", "https://api.bankr.bot/token-launches", true),
    checkFetch("X API", "https://api.twitter.com/2/tweets/search/recent?query=base", Boolean(process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN), {
      authorization: `Bearer ${process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN || ""}`
    })
  ]);

  persistProviderHealth(checks);
  return realtimeJson({
    chainId: BASE_CHAIN_ID,
    providers: checks,
    summary: {
      ok: checks.filter((check) => check.status === "ok").length,
      missing: checks.filter((check) => check.status === "missing").length,
      limited: checks.filter((check) => check.status === "limited").length,
      error: checks.filter((check) => check.status === "error").length,
      averageLatencyMs: average(checks.map((check) => check.latencyMs).filter((value): value is number => value !== null))
    }
  });
}

async function checkBaseRpc(): Promise<ProviderHealth> {
  return timed("Base RPC", true, async () => {
    const [latestBlock, chainId] = await Promise.all([getBlockNumber(), getBaseClient().getChainId()]);
    if (chainId !== BASE_CHAIN_ID) throw new Error(`chainId ${chainId}, expected ${BASE_CHAIN_ID}`);
    return { latestBlock };
  });
}

async function checkAlchemy(): Promise<ProviderHealth> {
  return timed("Alchemy Base RPC", Boolean(onchainConfig.alchemyBaseRpcUrl), async () => {
    await alchemy.getTokenMetadata(WETH);
    return {};
  });
}

async function checkBaseScan(): Promise<ProviderHealth> {
  return timed("Etherscan/BaseScan", basescan.isBaseScanConfigured(), async () => {
    await basescan.getContractSource(WETH);
    return {};
  });
}

async function checkBlockscout(): Promise<ProviderHealth> {
  return timed("Blockscout Base", true, async () => {
    await blockscout.getAddressInfo(WETH);
    return {};
  });
}

async function checkFetch(provider: string, url: string, configured: boolean, headers?: HeadersInit): Promise<ProviderHealth> {
  return timed(provider, configured, async () => {
    const response = await fetch(url, { cache: "no-store", headers: { accept: "application/json", ...(headers ?? {}) }, signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw createProviderStatusError(response.status, response.statusText);
    return {};
  });
}

async function timed(provider: string, configured: boolean, fn: () => Promise<{ latestBlock?: number | null }>): Promise<ProviderHealth> {
  if (!configured) {
    return { provider, status: "missing", latencyMs: null, configured: false, lastError: null, lastSuccessAt: null };
  }
  const started = Date.now();
  try {
    const result = await fn();
    return { provider, status: "ok", latencyMs: Date.now() - started, latestBlock: result.latestBlock ?? null, configured: true, lastError: null, lastSuccessAt: new Date().toISOString() };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown provider error";
    return {
      provider,
      status: isProviderLimit(message) ? "limited" : "error",
      latencyMs: Date.now() - started,
      configured: true,
      lastError: message,
      lastSuccessAt: null
    };
  }
}

function createProviderStatusError(status: number, statusText: string) {
  const error = new Error(`${status} ${statusText}`);
  error.name = status === 402 || status === 403 || status === 429 ? "ProviderLimitedError" : "ProviderError";
  return error;
}

function isProviderLimit(message: string) {
  return /\b(402|403|429)\b/i.test(message) || /rate limit|too many requests|payment required|forbidden/i.test(message);
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}
