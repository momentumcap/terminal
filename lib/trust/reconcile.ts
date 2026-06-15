import { STALE_THRESHOLDS_MS, staleAwareMetric } from "@/lib/trust/staleness";
import type { DataQuality, TrustedMetric, TrustConfidence } from "@/lib/trust/types";

type SourceValue<T> = {
  source: string;
  value: T | null | undefined;
  updatedAt?: string | null;
  confidence?: TrustConfidence;
  isEstimated?: boolean;
  warnings?: string[];
};

const now = () => new Date().toISOString();

function numericDisagreement(values: number[]) {
  if (values.length < 2) return 0;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === 0) return 0;
  return (max - min) / max;
}

function buildNumericMetric(label: string, values: SourceValue<number>[], threshold: number, staleAfterMs: number): TrustedMetric<number> {
  const usable = values.filter((item) => Number.isFinite(item.value ?? NaN)) as Array<SourceValue<number> & { value: number }>;
  const sourcesTried = values.map((item) => item.source);
  const sourceValues = Object.fromEntries(values.map((item) => [item.source, item.value ?? null]));
  const disagreement = numericDisagreement(usable.map((item) => item.value));
  const best = usable[0];
  const warnings = values.flatMap((item) => item.warnings ?? []);
  if (disagreement > threshold) warnings.push(`${label} differs across sources by ${(disagreement * 100).toFixed(1)}%.`);
  const confidence: TrustConfidence = !best ? "low" : disagreement > threshold * 2 ? "low" : disagreement > threshold ? "medium" : usable.length > 1 ? "high" : best.confidence ?? "medium";
  return staleAwareMetric({
    label,
    value: best?.value ?? null,
    source: best?.source ?? "unavailable",
    sourcesTried,
    confidence,
    isEstimated: Boolean(best?.isEstimated),
    lastUpdated: best?.updatedAt ?? now(),
    missingFields: best ? [] : [label],
    warnings,
    metadata: { sourceValues, disagreementPct: Number((disagreement * 100).toFixed(2)) },
    staleAfterMs
  });
}

export function reconcilePrice(values: SourceValue<number>[]) {
  return buildNumericMetric("price", values, 0.03, STALE_THRESHOLDS_MS.market);
}

export function reconcileLiquidity(values: SourceValue<number>[]) {
  return buildNumericMetric("liquidity", values, 0.1, STALE_THRESHOLDS_MS.market);
}

export function reconcileVolume(values: SourceValue<number>[]) {
  return buildNumericMetric("volume", values, 0.15, STALE_THRESHOLDS_MS.market);
}

export function reconcileHolders(values: SourceValue<number>[]) {
  return buildNumericMetric("holders", values, 0.05, STALE_THRESHOLDS_MS.holders);
}

export function reconcileRiskFlags(values: SourceValue<string[]>[]): TrustedMetric<string[]> {
  const usable = values.filter((item) => Array.isArray(item.value)) as Array<SourceValue<string[]> & { value: string[] }>;
  const flags = [...new Set(usable.flatMap((item) => item.value))];
  const warnings = values.flatMap((item) => item.warnings ?? []);
  if (usable.length < values.length) warnings.push("Some risk providers did not return risk flags.");
  return staleAwareMetric({
    label: "risk flags",
    value: flags,
    source: usable.map((item) => item.source).join(" + ") || "unavailable",
    sourcesTried: values.map((item) => item.source),
    confidence: usable.length > 1 ? "high" : usable.length ? "medium" : "low",
    isEstimated: false,
    lastUpdated: usable[0]?.updatedAt ?? now(),
    missingFields: usable.length ? [] : ["riskFlags"],
    warnings,
    metadata: { sourceValues: Object.fromEntries(values.map((item) => [item.source, item.value ?? null])) },
    staleAfterMs: STALE_THRESHOLDS_MS.contractRisk
  });
}

export function reconcileTokenMetadata(values: SourceValue<Record<string, unknown>>[]): TrustedMetric<Record<string, unknown>> {
  const usable = values.filter((item) => item.value && typeof item.value === "object") as Array<SourceValue<Record<string, unknown>> & { value: Record<string, unknown> }>;
  const merged = Object.assign({}, ...usable.map((item) => item.value));
  const warnings = values.flatMap((item) => item.warnings ?? []);
  const symbols = new Set(usable.map((item) => item.value.symbol).filter(Boolean));
  if (symbols.size > 1) warnings.push("Token symbol differs across metadata sources.");
  return staleAwareMetric({
    label: "token metadata",
    value: usable.length ? merged : null,
    source: usable.map((item) => item.source).join(" + ") || "unavailable",
    sourcesTried: values.map((item) => item.source),
    confidence: warnings.length ? "medium" : usable.length > 1 ? "high" : usable.length ? "medium" : "low",
    isEstimated: false,
    lastUpdated: usable[0]?.updatedAt ?? now(),
    missingFields: usable.length ? [] : ["metadata"],
    warnings,
    staleAfterMs: STALE_THRESHOLDS_MS.market
  });
}

export function summarizeDataQuality(metrics: Array<TrustedMetric<unknown>>): DataQuality {
  const sourcesUsed = [...new Set(metrics.filter((metric) => metric.value !== null).map((metric) => metric.source))];
  const sourcesTried = [...new Set(metrics.flatMap((metric) => metric.sourcesTried))];
  return {
    confidence: metrics.some((metric) => metric.confidence === "low") ? "low" : metrics.some((metric) => metric.confidence === "medium") ? "medium" : "high",
    sourceCount: sourcesUsed.length,
    sourcesUsed,
    sourcesFailed: sourcesTried.filter((source) => !sourcesUsed.some((used) => used.includes(source))),
    staleFields: metrics.filter((metric) => metric.isStale).map((metric) => metric.label),
    estimatedFields: metrics.filter((metric) => metric.isEstimated).map((metric) => metric.label),
    missingFields: [...new Set(metrics.flatMap((metric) => metric.missingFields))],
    disagreementWarnings: [...new Set(metrics.flatMap((metric) => metric.warnings).filter((warning) => /differs|disagree/i.test(warning)))],
    fetchedAt: now()
  };
}
