import { fetchDexToken } from "@/lib/dexscreener";
import { CACHE_TTLS } from "@/lib/freshness";
import { withCache } from "@/lib/storage";
import { classifyBankrCreatorTier, classifyBankrVerdict, detectBankrLaunchRisks, scoreBankrLaunchCredibility, scoreBankrLaunchQuality, scoreBankrOpportunity, scoreBankrRisk } from "@/lib/bankrScoring";
import { getContractRiskProfile, getDeployerProfile, getTokenHolders, getTokenOnchainProfile } from "@/lib/onchain";
import { persistBankrLaunches } from "@/lib/db/repository";
import type { DataQuality } from "@/lib/trust/types";
import type { BankrLaunch } from "@/types/bankr";

const BANKR_URL = "https://api.bankr.bot/token-launches";
const recentLaunches = new Map<string, BankrLaunch>();

const str = (value: unknown, fallback = "") => (typeof value === "string" && value ? value : fallback);
const num = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

function readCreator(raw: any) {
  return raw.creator ?? raw.user ?? raw.xUser ?? raw.twitterUser ?? raw.account ?? raw.deployer ?? {};
}

export async function fetchBankrLaunches(): Promise<BankrLaunch[]> {
  return withCache("bankr:launches", CACHE_TTLS.bankrLaunchesMs, async () => {
    const normalized = (await fetchRawBankrLaunches())
      .filter((item) => str(item.chain).toLowerCase() === "base" || num(item.chainId) === 8453 || !item.chain)
      .map(normalizeBankrLaunch)
      .filter((launch) => launch.tokenAddress);
    const symbols = new Set<string>();
    const enriched: BankrLaunch[] = [];

    for (const launch of normalized) {
      const seen = symbols.has(launch.tokenSymbol.toLowerCase());
      const withMarket = await enrichBankrLaunchWithMarketData(launch);
      const flags = detectBankrLaunchRisks(withMarket, seen ? new Set([withMarket.tokenSymbol.toLowerCase()]) : new Set());
      const launchQualityScore = scoreBankrLaunchQuality({ ...withMarket, flags });
      const riskScore = scoreBankrRisk({ ...withMarket, flags, launchQualityScore });
      const opportunityScore = scoreBankrOpportunity({ ...withMarket, flags, launchQualityScore, riskScore });
      const stagedLaunch = { ...withMarket, flags, launchQualityScore, riskScore, opportunityScore };
      const verdict = classifyBankrVerdict(stagedLaunch);
      const finalLaunch = { ...stagedLaunch, ...verdict };
      symbols.add(finalLaunch.tokenSymbol.toLowerCase());
      recentLaunches.set(finalLaunch.tokenAddress.toLowerCase(), finalLaunch);
      enriched.push(finalLaunch);
    }

    pruneRecentLaunches();
    const launches = dedupeByAddress([...enriched, ...recentLaunches.values()]).sort((a, b) => new Date(b.launchedAt).getTime() - new Date(a.launchedAt).getTime());
    persistBankrLaunches(launches);
    return launches;
  });
}

export async function fetchBankrLaunchFeedSnapshot(): Promise<BankrLaunch[]> {
  return withCache("bankr:launches:feed", Math.min(CACHE_TTLS.bankrLaunchesMs, 30_000), async () => {
    const normalized = (await fetchRawBankrLaunches())
      .filter((item) => str(item.chain).toLowerCase() === "base" || num(item.chainId) === 8453 || !item.chain)
      .map(normalizeBankrLaunch)
      .filter((launch) => launch.tokenAddress);
    const symbols = new Set<string>();
    const launches = normalized.map((launch) => {
      const seen = symbols.has(launch.tokenSymbol.toLowerCase());
      const flags = detectBankrLaunchRisks(launch, seen ? new Set([launch.tokenSymbol.toLowerCase()]) : new Set());
      const launchQualityScore = scoreBankrLaunchQuality({ ...launch, flags });
      const riskScore = scoreBankrRisk({ ...launch, flags, launchQualityScore });
      const opportunityScore = scoreBankrOpportunity({ ...launch, flags, launchQualityScore, riskScore });
      const stagedLaunch = { ...launch, flags, launchQualityScore, riskScore, opportunityScore };
      const finalLaunch = { ...stagedLaunch, ...classifyBankrVerdict(stagedLaunch) };
      symbols.add(finalLaunch.tokenSymbol.toLowerCase());
      recentLaunches.set(finalLaunch.tokenAddress.toLowerCase(), finalLaunch);
      return finalLaunch;
    });

    pruneRecentLaunches();
    const sorted = dedupeByAddress([...launches, ...recentLaunches.values()]).sort((a, b) => new Date(b.launchedAt).getTime() - new Date(a.launchedAt).getTime());
    persistBankrLaunches(sorted);
    return sorted;
  });
}

export function normalizeBankrLaunch(raw: any): BankrLaunch {
  const creator = readCreator(raw);
  const timestamp = num(raw.timestamp ?? raw.createdAt ?? raw.launchedAt ?? raw.deployedAt) ?? Date.now();
  const launchedAt = typeof raw.createdAt === "string" ? raw.createdAt : new Date(timestamp).toISOString();
  const tokenAddress = str(raw.tokenAddress ?? raw.address ?? raw.contractAddress);
  const creatorHandle = str(creator.handle ?? creator.username ?? creator.xHandle ?? raw.creatorHandle ?? raw.xHandle).replace(/^@/, "") || undefined;

  const launch: BankrLaunch = {
    id: str(raw.activityId ?? raw.id ?? tokenAddress, tokenAddress),
    chainId: 8453,
    tokenAddress,
    tokenName: str(raw.tokenName ?? raw.name, "Unknown Bankr Token"),
    tokenSymbol: str(raw.tokenSymbol ?? raw.symbol, "BANKR").toUpperCase(),
    creatorHandle,
    creatorName: str(creator.name ?? raw.creatorName) || undefined,
    creatorProfileUrl: str(creator.profileUrl ?? creator.url ?? (creatorHandle ? `https://x.com/${creatorHandle}` : "")) || undefined,
    creatorFollowers: num(creator.followers ?? creator.followerCount ?? raw.creatorFollowers),
    creatorVerified: Boolean(creator.verified ?? raw.creatorVerified ?? false),
    creatorCreatedAt: str(creator.createdAt ?? raw.creatorCreatedAt) || undefined,
    launchPostUrl: str(raw.launchPostUrl ?? raw.tweetUrl ?? raw.postUrl) || undefined,
    launchText: str(raw.launchText ?? raw.text ?? raw.description) || undefined,
    launchedAt,
    ageMinutes: Math.max(0, Math.round((Date.now() - new Date(launchedAt).getTime()) / 60000)),
    creatorTier: classifyBankrCreatorTier(creatorHandle),
    verdict: "speculative",
    verdictReason: "Pending enrichment",
    gateChecks: {
      creatorCleared: false,
      marketDataReady: false,
      liquidityCleared: false,
      sellabilityCleared: false,
      contractCleared: false,
      deployerCleared: false
    },
    credibilityScore: 0,
    launchQualityScore: 0,
    riskScore: 0,
    opportunityScore: 0,
    dataQuality: buildBankrDataQuality(["Bankr"], [], [], [], ["marketData", "contractRisk", "holders"]),
    flags: []
  };
  launch.credibilityScore = scoreBankrLaunchCredibility(launch);
  return launch;
}

async function fetchRawBankrLaunches(): Promise<any[]> {
  try {
    const response = await fetch(BANKR_URL, { cache: "no-store", headers: { accept: "application/json" } });
    if (!response.ok) throw new Error(`Bankr ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : data.launches ?? data.data ?? [];
  } catch {
    return [];
  }
}

export async function enrichBankrLaunchWithMarketData(launch: BankrLaunch): Promise<BankrLaunch> {
  const onchain = await enrichBankrLaunchWithOnchainData(launch);
  try {
    const pairs = await fetchDexToken(onchain.tokenAddress);
    const best = pairs.sort((a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0))[0];
    if (!best) return onchain;
    return {
      ...onchain,
      dexPairAddress: best.pairAddress,
      priceUsd: best.priceUsd ?? undefined,
      liquidityUsd: best.liquidityUsd ?? undefined,
      fdv: best.fdv ?? undefined,
      marketCap: best.marketCap ?? undefined,
      volume5m: best.volume5m ?? undefined,
      volume1h: best.volume1h ?? undefined,
      volume24h: best.volume24h ?? undefined,
      buys5m: best.txns5mBuys ?? undefined,
      sells5m: best.txns5mSells ?? undefined,
      holdersEstimate: best.volume24h ? Math.round(Math.log10(Math.max(best.volume24h, 1)) * 180) : undefined
    };
  } catch {
    return onchain;
  }
}

async function enrichBankrLaunchWithOnchainData(launch: BankrLaunch): Promise<BankrLaunch> {
  try {
    const [profile, risk, deployer, holders] = await Promise.all([
      getTokenOnchainProfile(launch.tokenAddress).catch(() => null),
      getContractRiskProfile(launch.tokenAddress).catch(() => null),
      getDeployerProfile(launch.tokenAddress).catch(() => null),
      getTokenHolders(launch.tokenAddress, { limit: 25 }).catch(() => null)
    ]);
    const flags = [...launch.flags];
    if (risk && risk.contractSafetyScore < 55) flags.push({ type: "contract_unverified", severity: "danger", message: "Onchain risk adapter found elevated contract risk" });
    if (deployer && deployer.reputationScore < 45) flags.push({ type: "fresh_deployer", severity: "warning", message: "Deployer reputation is weak or under-observed" });
    return {
      ...launch,
      tokenName: profile?.name ?? launch.tokenName,
      tokenSymbol: profile?.symbol ?? launch.tokenSymbol,
      contractSafetyScore: risk?.contractSafetyScore,
      deployerReputationScore: deployer?.reputationScore,
      concentrationRisk: holders?.concentrationRisk,
      holdersEstimate: holders?.holders.length || launch.holdersEstimate,
      onchainConfidence: profile?.dataQuality.confidence ?? risk?.dataQuality.confidence ?? launch.onchainConfidence,
      dataQuality: buildBankrDataQuality(
        ["Bankr", ...(profile ? ["BaseRPC"] : []), ...(risk ? [risk.dataQuality.source] : []), ...(deployer ? [deployer.dataQuality.source] : []), ...(holders ? [holders.dataQuality.source] : [])],
        [],
        holders?.dataQuality.warnings ?? [],
        holders?.dataQuality.isPartial ? ["holders"] : [],
        [
          ...(profile ? [] : ["contractMetadata"]),
          ...(risk ? [] : ["contractRisk"]),
          ...(deployer ? [] : ["deployer"]),
          ...(holders?.totalHolders ? [] : ["holderTotal"])
        ]
      ),
      flags
    };
  } catch {
    return launch;
  }
}

function buildBankrDataQuality(sourcesUsed: string[], sourcesFailed: string[], warnings: string[], estimatedFields: string[], missingFields: string[]): DataQuality {
  return {
    confidence: missingFields.length > 2 ? "low" : missingFields.length ? "medium" : "high",
    sourceCount: [...new Set(sourcesUsed)].length,
    sourcesUsed: [...new Set(sourcesUsed)],
    sourcesFailed,
    staleFields: [],
    estimatedFields,
    missingFields,
    disagreementWarnings: warnings.filter((warning) => /differs|disagree/i.test(warning)),
    fetchedAt: new Date().toISOString()
  };
}

export async function getBankrLaunch(address: string): Promise<BankrLaunch | null> {
  const launches = await fetchBankrLaunches();
  return launches.find((launch) => launch.tokenAddress.toLowerCase() === address.toLowerCase()) ?? null;
}

export async function getCredibleBankrLaunches(): Promise<BankrLaunch[]> {
  const launches = await fetchBankrLaunches();
  return launches.filter((launch) => launch.verdict === "verified_alpha" || launch.verdict === "watch" || launch.credibilityScore >= 70).sort((a, b) => b.opportunityScore - a.opportunityScore);
}

function dedupeByAddress(launches: BankrLaunch[]) {
  const map = new Map<string, BankrLaunch>();
  for (const launch of launches) {
    const key = launch.tokenAddress.toLowerCase();
    const previous = map.get(key);
    if (!previous || launch.opportunityScore > previous.opportunityScore) map.set(key, launch);
  }
  return [...map.values()];
}

function pruneRecentLaunches() {
  const minTime = Date.now() - 864e5;
  for (const [address, launch] of recentLaunches.entries()) {
    if (new Date(launch.launchedAt).getTime() < minTime) recentLaunches.delete(address);
  }
}
