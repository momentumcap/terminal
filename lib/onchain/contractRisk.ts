import { getCode } from "@/lib/onchain/client";
import { createDataQuality, normalizeAddress } from "@/lib/onchain/config";
import { ONCHAIN_TTLS, withOnchainCache } from "@/lib/onchain/cache";
import { getERC20Metadata } from "@/lib/onchain/erc20";
import * as basescan from "@/lib/onchain/providers/basescan";
import * as blockscout from "@/lib/onchain/providers/blockscout";
import type { ContractRiskProfile, RiskFlag } from "@/lib/onchain/types";

const KEYWORDS = {
  canMint: ["mint("],
  canPause: ["pause(", "paused("],
  canBlacklist: ["blacklist", "isBlacklisted"],
  hasTransferTax: ["setTax", "setFees", "excludeFromFees", "fee"],
  maxTx: ["setMaxTx", "maxTx"],
  maxWallet: ["setMaxWallet", "maxWallet"],
  proxy: ["upgradeTo", "implementation", "proxyAdmin"]
};

export async function getContractRiskProfile(address: string): Promise<ContractRiskProfile> {
  const normalized = normalizeAddress(address);
  return withOnchainCache(`risk:${normalized}`, ONCHAIN_TTLS.contractRisk, async () => {
    const sourcesTried = ["BaseRPC"];
    const warnings: string[] = [];
    const sourceBlobs: string[] = [];
    let verified = false;

    const metadata = await getERC20Metadata(normalized).catch(() => null);
    const owner = metadata?.owner;

    try {
      sourcesTried.push("BaseScan");
      const source = await basescan.getContractSource(normalized);
      if (source) {
        verified = Boolean(source.SourceCode || source.ABI);
        sourceBlobs.push(String(source.SourceCode ?? ""), String(source.ABI ?? ""));
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "BaseScan unavailable.");
    }

    try {
      sourcesTried.push("Blockscout");
      const source = await blockscout.getContractSource(normalized);
      if (source) {
        verified = verified || Boolean(source.is_verified || source.is_verified_via_eth_bytecode_db || source.source_code);
        sourceBlobs.push(JSON.stringify(source));
      }
    } catch {
      warnings.push("Blockscout source unavailable.");
    }

    const bytecode = await getCode(normalized).catch(() => undefined);
    const evidence = sourceBlobs.join("\n");
    const suspiciousFunctions = scanFunctions(evidence);
    const flags = buildRiskFlags(evidence, verified, Boolean(bytecode && bytecode !== "0x"));
    const isProxy = hasAny(evidence, KEYWORDS.proxy) || Boolean(bytecode && /363d3d373d3d3d363d73/i.test(bytecode));
    const penalties = flags.reduce((sum, flag) => sum + (flag.severity === "danger" ? 22 : flag.severity === "warning" ? 10 : 2), 0);

    return {
      tokenAddress: normalized,
      verified,
      owner,
      isProxy,
      canMint: hasAny(evidence, KEYWORDS.canMint),
      canPause: hasAny(evidence, KEYWORDS.canPause),
      canBlacklist: hasAny(evidence, KEYWORDS.canBlacklist),
      hasTransferTax: hasAny(evidence, KEYWORDS.hasTransferTax),
      maxTx: hasAny(evidence, KEYWORDS.maxTx),
      maxWallet: hasAny(evidence, KEYWORDS.maxWallet),
      suspiciousFunctions,
      riskFlags: flags,
      contractSafetyScore: Math.max(0, Math.min(100, 92 - penalties - (verified ? 0 : 12))),
      dataQuality: createDataQuality({
        source: verified ? "BaseScan/Blockscout" : "BaseRPC",
        sourcesTried,
        confidence: verified ? "medium" : "low",
        isPartial: !verified,
        missingFields: verified ? [] : ["verifiedSource", "abi"],
        warnings: [...warnings, ...(!verified ? ["Risk flags are heuristic because verified source/ABI was unavailable."] : [])]
      })
    };
  });
}

function scanFunctions(source: string) {
  const found = new Set<string>();
  for (const keywords of Object.values(KEYWORDS)) {
    for (const keyword of keywords) if (source.toLowerCase().includes(keyword.toLowerCase())) found.add(keyword.replace("(", ""));
  }
  return [...found];
}

function hasAny(source: string, keywords: string[]) {
  return keywords.some((keyword) => source.toLowerCase().includes(keyword.toLowerCase()));
}

function buildRiskFlags(source: string, verified: boolean, hasCode: boolean): RiskFlag[] {
  const flags: RiskFlag[] = [];
  if (!hasCode) flags.push({ type: "no_code", severity: "danger", message: "No contract bytecode found at this address." });
  if (!verified) flags.push({ type: "unverified_source", severity: "warning", message: "Verified contract source was not available from configured indexers." });
  if (hasAny(source, KEYWORDS.canMint)) flags.push({ type: "mint_function", severity: "warning", message: "Mint-like function name detected in source/ABI.", evidence: "mint" });
  if (hasAny(source, KEYWORDS.canPause)) flags.push({ type: "pause_function", severity: "warning", message: "Pause-like function name detected in source/ABI.", evidence: "pause" });
  if (hasAny(source, KEYWORDS.canBlacklist)) flags.push({ type: "blacklist_function", severity: "danger", message: "Blacklist-like function name detected in source/ABI.", evidence: "blacklist" });
  if (hasAny(source, KEYWORDS.hasTransferTax)) flags.push({ type: "tax_function", severity: "warning", message: "Fee/tax controls may exist. Verify sellability before trading.", evidence: "fee/tax" });
  if (hasAny(source, KEYWORDS.proxy)) flags.push({ type: "proxy_upgrade", severity: "warning", message: "Proxy/upgrade-related function name detected.", evidence: "upgrade/proxy" });
  return flags;
}
