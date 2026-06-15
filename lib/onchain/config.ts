export const BASE_CHAIN_ID = 8453 as const;
export const BASE_NATIVE_TOKEN = "ETH";
export const DEFAULT_BASE_RPC_URL = "https://mainnet.base.org";
export const DEFAULT_BLOCKSCOUT_BASE_API_URL = "https://base.blockscout.com";

export const onchainConfig = {
  chainId: BASE_CHAIN_ID,
  nativeToken: BASE_NATIVE_TOKEN,
  alchemyBaseRpcUrl: process.env.ALCHEMY_BASE_RPC_URL || (process.env.ALCHEMY_API_KEY ? `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : ""),
  baseRpcUrl: process.env.ALCHEMY_BASE_RPC_URL || (process.env.ALCHEMY_API_KEY ? `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}` : "") || process.env.BASE_RPC_URL || DEFAULT_BASE_RPC_URL,
  baseWsUrl: process.env.BASE_WS_URL || "",
  alchemyApiKey: process.env.ALCHEMY_API_KEY || "",
  basescanApiKey: process.env.BASESCAN_API_KEY || process.env.ETHERSCAN_API_KEY || "",
  etherscanApiKey: process.env.ETHERSCAN_API_KEY || "",
  blockscoutBaseApiUrl: (process.env.BLOCKSCOUT_BASE_API_URL || process.env.BLOCKSCOUT_BASE_URL || DEFAULT_BLOCKSCOUT_BASE_API_URL).replace(/\/api$/, "").replace(/\/$/, ""),
  indexerProvider: process.env.INDEXER_PROVIDER || "auto"
};

export function isBaseAddress(value: string | undefined | null): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function normalizeAddress(value: string) {
  return value.toLowerCase();
}

export function createDataQuality(input: Partial<import("./types").DataQuality> & { source: string; sourcesTried?: string[] }): import("./types").DataQuality {
  return {
    source: input.source,
    sourcesTried: input.sourcesTried ?? [input.source],
    confidence: input.confidence ?? "low",
    isPartial: input.isPartial ?? true,
    missingFields: input.missingFields ?? [],
    warnings: input.warnings ?? [],
    fetchedAt: input.fetchedAt ?? new Date().toISOString()
  };
}
