import { z } from "zod";
import { onchainConfig, normalizeAddress } from "@/lib/onchain/config";
import { withProviderGuard } from "@/lib/onchain/rateLimit";

const GoldRushHolderItem = z.object({
  contract_decimals: z.number().nullable().optional(),
  contract_name: z.string().nullable().optional(),
  contract_ticker_symbol: z.string().nullable().optional(),
  contract_address: z.string().nullable().optional(),
  address: z.string(),
  balance: z.string(),
  total_supply: z.string().nullable().optional(),
  block_height: z.number().nullable().optional()
}).passthrough();

const GoldRushHoldersResponse = z.object({
  data: z.object({
    updated_at: z.string().nullable().optional(),
    chain_id: z.number().nullable().optional(),
    chain_name: z.string().nullable().optional(),
    chain_tip_height: z.number().nullable().optional(),
    chain_tip_signed_at: z.string().nullable().optional(),
    items: z.array(GoldRushHolderItem).default([]),
    pagination: z.object({
      has_more: z.boolean().nullable().optional(),
      page_number: z.number().nullable().optional(),
      page_size: z.number().nullable().optional(),
      total_count: z.number().nullable().optional()
    }).partial().nullable().optional()
  }).passthrough().optional(),
  error: z.boolean().nullable().optional(),
  error_message: z.string().nullable().optional()
}).passthrough();

export type GoldRushHolderItem = z.infer<typeof GoldRushHolderItem>;

export interface GoldRushTokenHoldersResult {
  items: GoldRushHolderItem[];
  totalCount?: number;
  updatedAt?: string;
  chainTipHeight?: number;
  chainTipSignedAt?: string;
  noSnapshot: boolean;
}

export function isGoldRushConfigured() {
  return Boolean(onchainConfig.goldrushApiKey);
}

export async function getTokenHolders(address: string, options: { limit?: number; pageNumber?: number; noSnapshot?: boolean } = {}): Promise<GoldRushTokenHoldersResult> {
  if (!isGoldRushConfigured()) throw new Error("GoldRush API key missing");
  const normalized = normalizeAddress(address);
  const pageSize = (options.limit ?? 100) > 100 ? 1000 : 100;
  const pageNumber = Math.max(0, options.pageNumber ?? 0);
  const noSnapshot = options.noSnapshot ?? onchainConfig.goldrushHoldersNoSnapshot;
  const params = new URLSearchParams({
    "page-size": String(pageSize),
    "page-number": String(pageNumber),
    "no-snapshot": String(noSnapshot)
  });
  const result = await goldrushFetch(`/v1/base-mainnet/tokens/${normalized}/token_holders_v2/?${params.toString()}`);
  const data = result.data;
  return {
    items: data?.items ?? [],
    totalCount: numberish(data?.pagination?.total_count),
    updatedAt: data?.updated_at ?? undefined,
    chainTipHeight: numberish(data?.chain_tip_height),
    chainTipSignedAt: data?.chain_tip_signed_at ?? undefined,
    noSnapshot
  };
}

export async function healthCheck() {
  const weth = "0x4200000000000000000000000000000000000006";
  const result = await getTokenHolders(weth, { limit: 100, noSnapshot: false });
  return { latestBlock: result.chainTipHeight ?? null };
}

async function goldrushFetch(path: string) {
  return withProviderGuard("goldrush", async () => {
    const response = await fetch(`${onchainConfig.goldrushBaseUrl}${path}`, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${onchainConfig.goldrushApiKey}`
      }
    });
    if (!response.ok) throw createGoldRushError(response.status, response.statusText);
    const parsed = GoldRushHoldersResponse.parse(await response.json());
    if (parsed.error) throw new Error(parsed.error_message || "GoldRush returned an error");
    return parsed;
  }, { concurrency: 2, retries: 1, timeoutMs: 15_000 });
}

function createGoldRushError(status: number, statusText: string) {
  const error = new Error(`GoldRush ${status} ${statusText}`);
  error.name = status === 402 || status === 403 || status === 429 ? "ProviderLimitedError" : "ProviderError";
  return error;
}

function numberish(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
