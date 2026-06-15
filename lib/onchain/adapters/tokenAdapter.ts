import { BASE_CHAIN_ID, createDataQuality, normalizeAddress } from "@/lib/onchain/config";
import { ONCHAIN_TTLS, withOnchainCache } from "@/lib/onchain/cache";
import { getERC20Metadata } from "@/lib/onchain/erc20";
import { getTokenTransferLogs } from "@/lib/onchain/transfers";
import * as blockscout from "@/lib/onchain/providers/blockscout";
import * as basescan from "@/lib/onchain/providers/basescan";
import type { OnchainTokenProfile } from "@/lib/onchain/types";

export async function getTokenOnchainProfile(address: string): Promise<OnchainTokenProfile> {
  const normalized = normalizeAddress(address);
  return withOnchainCache(`profile:${normalized}`, ONCHAIN_TTLS.tokenMetadata, async () => {
    const sourcesTried = ["BaseRPC"];
    const warnings: string[] = [];
    const metadata = await getERC20Metadata(normalized);
    let holdersCount: number | undefined;
    let verified: boolean | undefined;
    let deployer: string | undefined;
    let creationTxHash: string | undefined;
    let createdAt: string | undefined;

    try {
      sourcesTried.push("Blockscout");
      const info = await blockscout.getTokenInfo(normalized) as any;
      holdersCount = Number(info.holders_count ?? info.holders ?? info.total_holders) || undefined;
      verified = Boolean(info.is_verified ?? info.address?.is_verified ?? verified);
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
      !metadata.name ? "name" : "",
      !metadata.symbol ? "symbol" : "",
      metadata.decimals === undefined ? "decimals" : "",
      !metadata.totalSupply ? "totalSupply" : "",
      holdersCount === undefined ? "holdersCount" : "",
      !deployer ? "deployer" : ""
    ].filter(Boolean);

    return {
      chainId: BASE_CHAIN_ID,
      address: normalized,
      name: metadata.name,
      symbol: metadata.symbol,
      decimals: metadata.decimals,
      totalSupply: metadata.totalSupply,
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
