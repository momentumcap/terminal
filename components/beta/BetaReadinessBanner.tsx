"use client";

import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type FreshnessService = {
  enabled: boolean;
  running: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  runCount: number;
};

type TrustSummary = {
  health: "healthy" | "watch" | "degraded";
  staleRate: number | null;
  disagreementRate: number | null;
  providerErrors: number;
  providerMissing: number;
  providerLimited: number;
  coreProviderLimited: number;
  topWarnings: string[];
  freshnessService?: FreshnessService;
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

export function BetaReadinessBanner({ compact = false }: { compact?: boolean }) {
  const [summary, setSummary] = useState<TrustSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetch("/api/trust/summary", { cache: "no-store" }).then((response) => response.json());
        if (!cancelled) setSummary(data.trust ?? null);
      } catch {
        if (!cancelled) setSummary(null);
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

  const staleRate = summary?.staleRate ?? null;
  const disagreementRate = summary?.disagreementRate ?? null;
  const freshnessRunning = Boolean(summary?.freshnessService?.enabled);
  const blocked = !summary || summary.health === "degraded" || (staleRate ?? 0) > 0.15 || summary.providerErrors > 0;
  const watch = !blocked && (summary.health === "watch" || (disagreementRate ?? 0) > 0.1 || summary.providerMissing > 0 || summary.coreProviderLimited > 0);
  const state = loading ? "checking" : blocked ? "not public beta ready" : watch ? "private beta only" : "public beta candidate";
  const tone = loading
    ? "border-terminal-cyan/35 bg-terminal-cyan/10 text-terminal-cyan"
    : blocked
      ? "border-terminal-red/35 bg-terminal-red/10 text-terminal-red"
      : watch
        ? "border-terminal-amber/35 bg-terminal-amber/10 text-terminal-amber"
        : "border-terminal-green/35 bg-terminal-green/10 text-terminal-green";
  const Icon = loading ? RefreshCw : blocked ? AlertTriangle : watch ? ShieldAlert : CheckCircle2;
  const failedProvider = summary?.failedProviders?.[0] ?? null;
  const topDisagreement = summary?.topDisagreements?.[0] ?? null;

  return (
    <section className={`rounded-lg border ${tone} ${compact ? "px-2.5 py-1.5" : "p-3"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon size={15} className={loading || summary?.freshnessService?.running ? "animate-spin" : ""} />
          <div className="font-mono text-[10px] uppercase tracking-[0.14em]">Beta Readiness: {state}</div>
        </div>
        <div className={`flex flex-wrap items-center font-mono text-[10px] uppercase tracking-[0.12em] ${compact ? "gap-1.5" : "gap-2"}`}>
          <Link href="/status" className="transition hover:text-terminal-text">Status</Link>
          <span className="opacity-40">/</span>
          <Link href="/admin/accuracy" className="transition hover:text-terminal-text">Accuracy</Link>
          <span className="opacity-40">/</span>
          <Link href="/limitations" className="transition hover:text-terminal-text">Limits</Link>
        </div>
      </div>
      {!compact && (
        <div className="mt-2 grid gap-2 text-[11px] text-terminal-muted md:grid-cols-4">
          <ReadinessMetric label="Freshness" value={formatPct(staleRate)} />
          <ReadinessMetric label="Disagreement" value={formatPct(disagreementRate)} />
          <ReadinessMetric label="Providers" value={summary ? `${summary.providerErrors} err / ${summary.providerMissing} missing / ${summary.providerLimited} limited` : "checking"} />
          <ReadinessMetric label="Heartbeat" value={freshnessRunning ? summary?.freshnessService?.running ? "refreshing" : "running" : "stopped"} />
        </div>
      )}
      {!compact && summary?.topWarnings?.length ? (
        <div className="mt-2 border-t border-current/20 pt-2 text-xs text-terminal-muted">{summary.topWarnings[0]}</div>
      ) : null}
      {!compact && (failedProvider || topDisagreement) ? (
        <div className="mt-2 grid gap-2 border-t border-current/20 pt-2 text-xs md:grid-cols-2">
          {failedProvider ? (
            <div className="rounded-md border border-current/20 bg-terminal-bg/35 p-2">
              <div className="font-mono text-[9px] uppercase tracking-[0.12em] opacity-70">Provider Blocker</div>
              <div className="mt-1 text-terminal-text">{failedProvider.provider}: {failedProvider.status}</div>
              <div className="mt-1 truncate text-terminal-muted">{failedProvider.lastError ?? "No latest error message recorded."}</div>
            </div>
          ) : null}
          {topDisagreement ? (
            <div className="rounded-md border border-current/20 bg-terminal-bg/35 p-2">
              <div className="font-mono text-[9px] uppercase tracking-[0.12em] opacity-70">Source Disagreement</div>
              <div className="mt-1 text-terminal-text">
                {topDisagreement.symbol ?? "Token"} {topDisagreement.metric}: {topDisagreement.disagreementPct.toFixed(1)}%
              </div>
              <div className="mt-1 truncate text-terminal-muted">{topDisagreement.sources.map((source) => source.source).join(" vs ")}</div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ReadinessMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-current/20 bg-terminal-bg/35 px-2 py-1">
      <div className="text-[9px] uppercase tracking-[0.12em] opacity-70">{label}</div>
      <div className="font-mono text-xs text-terminal-text">{value}</div>
    </div>
  );
}

function formatPct(value: number | null | undefined) {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "N/A";
}
