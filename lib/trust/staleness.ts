import type { TrustConfidence, TrustedMetric } from "@/lib/trust/types";

export const STALE_THRESHOLDS_MS = {
  market: 90_000,
  geckoterminal: 120_000,
  holders: 15 * 60_000,
  contractRisk: 6 * 60 * 60_000,
  deployer: 60 * 60_000,
  alerts: 120_000
};

export function isTrustStale(lastUpdated: string | null | undefined, thresholdMs: number) {
  if (!lastUpdated) return true;
  const time = new Date(lastUpdated).getTime();
  return !Number.isFinite(time) || Date.now() - time > thresholdMs;
}

export function downgradeForStaleness(confidence: TrustConfidence, stale: boolean): TrustConfidence {
  if (!stale) return confidence;
  return confidence === "high" ? "medium" : "low";
}

export function staleAwareMetric<T>(metric: Omit<TrustedMetric<T>, "isStale" | "confidence"> & { confidence: TrustConfidence; staleAfterMs: number }): TrustedMetric<T> {
  const isStale = isTrustStale(metric.lastUpdated, metric.staleAfterMs);
  const trustedMetric = stripStaleThreshold(metric);
  return {
    ...trustedMetric,
    isStale,
    confidence: downgradeForStaleness(metric.confidence, isStale),
    warnings: isStale ? [...metric.warnings, `${metric.label} is stale.`] : metric.warnings
  };
}

function stripStaleThreshold<T>(metric: Omit<TrustedMetric<T>, "isStale" | "confidence"> & { confidence: TrustConfidence; staleAfterMs: number }) {
  return {
    value: metric.value,
    label: metric.label,
    source: metric.source,
    sourcesTried: metric.sourcesTried,
    confidence: metric.confidence,
    isEstimated: metric.isEstimated,
    lastUpdated: metric.lastUpdated,
    missingFields: metric.missingFields,
    warnings: metric.warnings,
    metadata: metric.metadata
  };
}
