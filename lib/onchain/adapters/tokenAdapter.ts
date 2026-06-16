import { BASE_CHAIN_ID, createDataQuality, normalizeAddress } from "@/lib/onchain/config";
import { ONCHAIN_TTLS, withOnchainCache } from "@/lib/onchain/cache";
import { getERC20Metadata, getOnchainTokenMetadata } from "@/lib/onchain/erc20";
import { getTokenTransferLogs } from "@/lib/onchain/transfers";
import * as blockscout from "@/lib/onchain/providers/blockscout";
import * as basescan from "@/lib/onchain/providers/basescan";
import type { OnchainTokenProfile } from "@/lib/onchain/types";

export async function getTokenOnchainProfile(address: string): Promise<OnchainTokenProfile> {
  const normalized = normalizeAddress(address);
  return withOnchainCache(`profile:${normalized}`, ONCHAIN_TTLS.tokenMetadata, async () => {
    const sourcesTried = ["BaseRPC"];
    const warnings: string[] = [];
    const [metadata, rawMetadata] = await Promise.all([
      getERC20Metadata(normalized),
      withDeadline(getOnchainTokenMetadata(normalized), null, 1_800)
    ]);
    let holdersCount: number | undefined;
    let verified: boolean | undefined;
    let deployer: string | undefined;
    let creationTxHash: string | undefined;
    let createdAt: string | undefined;
    let blockscoutInfo: any = null;

    try {
      sourcesTried.push("Blockscout");
      blockscoutInfo = await blockscout.getTokenInfo(normalized) as any;
      holdersCount = numberish(blockscoutInfo.holders_count ?? blockscoutInfo.holders ?? blockscoutInfo.total_holders);
      verified = Boolean(blockscoutInfo.is_verified ?? blockscoutInfo.address?.is_verified ?? verified);
    } catch {
      warnings.push("Blockscout token profile unavailable.");
    }

    try {
      sourcesTried.push("BaseScan");
      const creation = await basescan.getContractCreation(normalized);
      deployer = creation?.contractCreator ? normalizeAddress(String(creation.contractCreator)) : undefined;
      creationTxHash = creation?.txHash;
      const source = await basescan.getContractSource(normalized);
      verified = verified || Boolean(source?.SourceCode);
    } catch {
      warnings.push("BaseScan enrichment unavailable or API key missing.");
    }

    const transfers = await withDeadline(getTokenTransferLogs(normalized), [], 900);
    const missingFields = [
      !coalesceString(metadata.name, rawMetadata?.name, blockscoutInfo?.name) ? "name" : "",
      !coalesceString(metadata.symbol, rawMetadata?.symbol, blockscoutInfo?.symbol) ? "symbol" : "",
      coalesceNumber(metadata.decimals, rawMetadata?.decimals, numberish(blockscoutInfo?.decimals)) === undefined ? "decimals" : "",
      !coalesceString(metadata.totalSupply, rawMetadata?.totalSupply, blockscoutInfo?.total_supply, blockscoutInfo?.totalSupply) ? "totalSupply" : "",
      holdersCount === undefined ? "holdersCount" : "",
      !deployer ? "deployer" : ""
    ].filter(Boolean);

    return {
      chainId: BASE_CHAIN_ID,
      address: normalized,
      name: coalesceString(metadata.name, rawMetadata?.name, blockscoutInfo?.name),
      symbol: coalesceString(metadata.symbol, rawMetadata?.symbol, blockscoutInfo?.symbol),
      decimals: coalesceNumber(metadata.decimals, rawMetadata?.decimals, numberish(blockscoutInfo?.decimals)),
      totalSupply: coalesceString(metadata.totalSupply, rawMetadata?.totalSupply, blockscoutInfo?.total_supply, blockscoutInfo?.totalSupply),
      owner: metadata.owner,
      deployer,
      creationTxHash,
      createdAt,
      verified,
      holdersCount,
      transferCount24h: transfers.length,
      dataQuality: createDataQuality({ source: "BaseRPC", sourcesTried, confidence: missingFields.length <= 2 ? "medium" : "low", isPartial: missingFields.length > 0, missingFields, warnings })
    };
  });
}

async function withDeadline<T>(promise: Promise<T>, fallback: T, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => resolve(fallback), timeoutMs);
      })
    ]);
  } catch {
    return fallback;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function coalesceString(...values: Array<unknown>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "bigint") return value.toString();
  }
  return undefined;
}

function coalesceNumber(...values: Array<unknown>) {
  for (const value of values) {
    const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : undefined;
    if (parsed !== undefined && Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function numberish(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : undefined;
  return parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined;
}
