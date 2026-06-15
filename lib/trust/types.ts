export type TrustConfidence = "high" | "medium" | "low";

export type TrustedMetric<T> = {
  value: T | null;
  label: string;
  source: string;
  sourcesTried: string[];
  confidence: TrustConfidence;
  isEstimated: boolean;
  isStale: boolean;
  lastUpdated: string;
  missingFields: string[];
  warnings: string[];
  metadata?: Record<string, unknown>;
};

export type DataQuality = {
  confidence: TrustConfidence;
  sourceCount: number;
  sourcesUsed: string[];
  sourcesFailed: string[];
  staleFields: string[];
  estimatedFields: string[];
  missingFields: string[];
  disagreementWarnings: string[];
  fetchedAt: string;
};

export type TrustedScore = {
  score: number | null;
  label: string;
  version: string;
  confidence: TrustConfidence;
  inputsUsed: string[];
  inputsMissing: string[];
  penalties: string[];
  boosts: string[];
  explanation: string;
  lastUpdated: string;
};

export type ProviderHealth = {
  provider: string;
  status: "ok" | "error" | "missing" | "configured" | "limited";
  latencyMs: number | null;
  latestBlock?: number | null;
  configured: boolean;
  lastError: string | null;
  lastSuccessAt: string | null;
};

export type AlertBacktestRecord = {
  token: string;
  alertType: string;
  firedAt: string;
  priceAtFire: number | null;
  liquidityAtFire: number | null;
  volumeAtFire: number | null;
  priceAfter5m: number | null;
  priceAfter1h: number | null;
  priceAfter24h: number | null;
  maxDrawdownAfter1h: number | null;
  maxUpsideAfter1h: number | null;
  outcome: "good" | "neutral" | "bad" | "unknown";
};
