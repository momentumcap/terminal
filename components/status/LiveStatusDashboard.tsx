"use client";

import type { ProviderHealth } from "@/lib/trust/types";
import { useEffect, useState } from "react";

type TrustSummary = {
  health: "healthy" | "watch" | "degraded";
  staleRate: number | null;
  disagreementRate: number | null;
  cacheHitRate: number | null;
  providerErrors: number;
  providerMissing: number;
  providerLimited: number;
  providersTracked: number;
  comparableTokens: number;
  topWarnings: string[];
  updatedAt: string;
  failedProviders?: Array<{
    provider: string;
    status: "ok" | "missing" | "error" | "limited";
    lastError: string | null;
    lastObservedAt: string | null;
    lastSuccessAt: string | null;
  }>;
  topDisagreements?: Array<{
    tokenAddress: string;
    symbol: string | null;
    metric: string;
    disagreementPct: number;
    sources: Array<{ source: string; value: number; observedAt: string }>;
  }>;
};

type ProviderResponse = {
  providers: ProviderHealth[];
  summary: { ok: number; missing: number; limited: number; error: number; averageLatencyMs: number | null };
};

type TrustResponse = { trust: TrustSummary };

const emptyProviders: ProviderResponse = {
  providers: [],
  summary: { ok: 0, missing: 0, limited: 0, error: 0, averageLatencyMs: null }
};

const emptyTrust: TrustSummary = {
  health: "watch",
  staleRate: null,
  disagreementRate: null,
  cacheHitRate: null,
  providerErrors: 0,
  providerMissing: 0,
  providerLimited: 0,
  providersTracked: 0,
  comparableTokens: 0,
  topWarnings: ["Loading live status..."],
  updatedAt: new Date().toISOString()
};

export function LiveStatusDashboard() {
  const [providers, setProviders] = useState<ProviderResponse>(emptyProviders);
  const [trust, setTrust] = useState<TrustSummary>(emptyTrust);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      try {
        const [providerResponse, trustResponse] = await Promise.all([
          fetch("/api/health/providers", { cache: "no-store" }).then((response) => response.json() as Promise<ProviderResponse>),
          fetch("/api/trust/summary", { cache: "no-store" }).then((response) => response.json() as Promise<TrustResponse>)
        ]);
        if (cancelled) return;
        setProviders(providerResponse);
        setTrust(trustResponse.trust);
      } catch {
        if (!cancelled) setError("Live status refresh failed. Retaining last displayed status.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const interval = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const headline = trust.health === "healthy" ? "Terminal operating normally" : trust.health === "watch" ? "Terminal in watch mode" : "Terminal degraded";

  return (
    <>
      <section className={`rounded-lg border p-5 ${statusPanelClass(trust.health)}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.14em] text-terminal-muted">Current Condition</div>
            <h2 className="mt-2 text-2xl font-semibold">{loading ? "Checking live providers..." : headline}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-terminal-muted">
              Updated {trust.updatedAt}. If this page shows degraded or watch mode, treat metrics as provisional and verify externally before trading.
            </p>
          </div>
          <div className={`rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-[0.12em] ${statusBadgeClass(trust.health)}`}>
            {loading ? "loading" : trust.health}
          </div>
        </div>
        {error && <div className="mt-3 rounded-lg border border-terminal-amber/30 bg-terminal-amber/10 p-3 text-xs text-terminal-amber">{error}</div>}
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-4">
        <Stat label="Providers OK" value={providers.summary.ok} tone="green" />
        <Stat label="Provider Errors" value={providers.summary.error} tone={providers.summary.error ? "red" : "green"} />
        <Stat label="Provider Limited" value={providers.summary.limited} tone={providers.summary.limited ? "amber" : "green"} />
        <Stat label="Provider Missing" value={providers.summary.missing} tone={providers.summary.missing ? "amber" : "green"} />
        <Stat label="Avg Latency" value={providers.summary.averageLatencyMs === null ? "N/A" : `${providers.summary.averageLatencyMs}ms`} tone="cyan" />
        <Stat label="Stale Data Rate" value={formatPct(trust.staleRate)} tone={trust.staleRate !== null && trust.staleRate > 0.2 ? "amber" : "green"} />
        <Stat label="Source Disagreement" value={formatPct(trust.disagreementRate)} tone={trust.disagreementRate !== null && trust.disagreementRate > 0.1 ? "amber" : "green"} />
        <Stat label="Cache Hit Rate" value={formatPct(trust.cacheHitRate)} tone="cyan" />
        <Stat label="Comparable Tokens" value={trust.comparableTokens} tone="cyan" />
      </section>

      {(trust.failedProviders?.length || trust.topDisagreements?.length) ? (
        <section className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-terminal-border bg-terminal-panel p-4">
            <div className="font-mono text-xs uppercase tracking-[0.14em] text-terminal-muted">Beta Blockers</div>
            <div className="mt-3 grid gap-2">
              {trust.failedProviders?.length ? trust.failedProviders.map((provider) => (
                <div key={provider.provider} className="rounded-lg border border-terminal-red/30 bg-terminal-red/10 p-3 text-sm">
                  <div className="font-mono text-terminal-red">{provider.provider}: {provider.status}</div>
                  <div className="mt-1 text-xs text-terminal-muted">{provider.lastError ?? "No latest provider error recorded."}</div>
                  <div className="mt-1 text-[11px] text-terminal-muted">Last success: {provider.lastSuccessAt ?? "none recorded"}</div>
                </div>
              )) : (
                <div className="rounded-lg border border-terminal-green/30 bg-terminal-green/10 p-3 text-sm text-terminal-green">No failed providers in the latest trust summary.</div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-terminal-border bg-terminal-panel p-4">
            <div className="font-mono text-xs uppercase tracking-[0.14em] text-terminal-muted">Top Source Disagreements</div>
            <div className="mt-3 grid gap-2">
              {trust.topDisagreements?.length ? trust.topDisagreements.slice(0, 3).map((issue) => (
                <div key={`${issue.tokenAddress}-${issue.metric}`} className="rounded-lg border border-terminal-amber/30 bg-terminal-amber/10 p-3 text-sm">
                  <div className="font-mono text-terminal-amber">{issue.symbol ?? "Token"} {issue.metric}: {issue.disagreementPct.toFixed(1)}%</div>
                  <div className="mt-1 grid gap-1 text-[11px] text-terminal-muted">
                    {issue.sources.map((source) => (
                      <div key={`${issue.tokenAddress}-${issue.metric}-${source.source}`} className="flex justify-between gap-3">
                        <span>{source.source}</span>
                        <span className="font-mono text-terminal-text">{formatNumber(source.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )) : (
                <div className="rounded-lg border border-terminal-green/30 bg-terminal-green/10 p-3 text-sm text-terminal-green">No active source disagreements in the latest trust summary.</div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-terminal-border bg-terminal-panel">
          <div className="border-b border-terminal-border p-3">
            <div className="font-mono text-xs uppercase tracking-[0.14em] text-terminal-muted">Provider Detail</div>
            <p className="mt-1 text-xs text-terminal-muted">Provider status loads after the page shell. Missing means not configured; error means configured but failing.</p>
          </div>
          <div className="overflow-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="text-[10px] uppercase tracking-[0.14em] text-terminal-muted">
                <tr className="border-b border-terminal-border">
                  <th className="px-3 py-2 text-left">Provider</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Latency</th>
                  <th className="px-3 py-2 text-right">Block</th>
                  <th className="px-3 py-2 text-left">Last Error</th>
                </tr>
              </thead>
              <tbody>
                {providers.providers.length ? providers.providers.map((provider) => (
                  <tr key={provider.provider} className="border-b border-terminal-border/60">
                    <td className="px-3 py-2 font-mono">{provider.provider}</td>
                    <td className={`px-3 py-2 font-mono ${provider.status === "ok" ? "text-terminal-green" : provider.status === "missing" || provider.status === "limited" ? "text-terminal-amber" : "text-terminal-red"}`}>{provider.status}</td>
                    <td className="px-3 py-2 text-right font-mono">{provider.latencyMs === null ? "N/A" : `${provider.latencyMs}ms`}</td>
                    <td className="px-3 py-2 text-right font-mono">{provider.latestBlock ?? "N/A"}</td>
                    <td className="max-w-[320px] truncate px-3 py-2 text-terminal-muted">{provider.lastError ?? "None"}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-terminal-muted">{loading ? "Loading provider status..." : "Provider status unavailable."}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-lg border border-terminal-border bg-terminal-panel p-4">
          <div className="font-mono text-xs uppercase tracking-[0.14em] text-terminal-muted">Warnings</div>
          <div className="mt-3 grid gap-2">
            {trust.topWarnings.length ? trust.topWarnings.map((warning) => (
              <div key={warning} className="rounded-lg border border-terminal-amber/30 bg-terminal-amber/10 p-3 text-sm text-terminal-amber">{warning}</div>
            )) : (
              <div className="rounded-lg border border-terminal-green/30 bg-terminal-green/10 p-3 text-sm text-terminal-green">No active trust warnings from persisted observations.</div>
            )}
          </div>
          <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-bg/50 p-3 text-xs leading-relaxed text-terminal-muted">
            Status reflects infrastructure and data quality only. It does not validate a token, creator, contract, or trade setup.
          </div>
        </aside>
      </section>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone: "green" | "amber" | "red" | "cyan" }) {
  const colors = {
    green: "text-terminal-green",
    amber: "text-terminal-amber",
    red: "text-terminal-red",
    cyan: "text-terminal-cyan"
  };
  return (
    <div className="rounded-lg border border-terminal-border bg-terminal-panel p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-terminal-muted">{label}</div>
      <div className={`mt-2 font-mono text-lg ${colors[tone]}`}>{value}</div>
    </div>
  );
}

function formatPct(value: number | null) {
  return value === null ? "N/A" : `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "N/A";
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (Math.abs(value) >= 1) return `$${value.toFixed(2)}`;
  return value.toPrecision(4);
}

function statusPanelClass(status: TrustSummary["health"]) {
  if (status === "healthy") return "border-terminal-green/35 bg-terminal-green/10";
  if (status === "watch") return "border-terminal-amber/35 bg-terminal-amber/10";
  return "border-terminal-red/35 bg-terminal-red/10";
}

function statusBadgeClass(status: TrustSummary["health"]) {
  if (status === "healthy") return "border-terminal-green/40 bg-terminal-green/10 text-terminal-green";
  if (status === "watch") return "border-terminal-amber/40 bg-terminal-amber/10 text-terminal-amber";
  return "border-terminal-red/40 bg-terminal-red/10 text-terminal-red";
}
