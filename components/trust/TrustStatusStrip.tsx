"use client";

import { ShieldCheck, ShieldAlert, WifiOff } from "lucide-react";
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
};

export function TrustStatusStrip({ compact = false }: { compact?: boolean }) {
  const [summary, setSummary] = useState<TrustSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await fetch("/api/trust/summary", { cache: "no-store" }).then((response) => response.json());
        if (!cancelled) setSummary(data.trust ?? null);
      } catch {
        if (!cancelled) setSummary(null);
      }
    };
    load();
    const interval = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const health = summary?.health ?? "watch";
  const tone = health === "healthy"
    ? "border-terminal-green/35 bg-terminal-green/10 text-terminal-green"
    : health === "watch"
      ? "border-terminal-amber/35 bg-terminal-amber/10 text-terminal-amber"
      : "border-terminal-red/35 bg-terminal-red/10 text-terminal-red";
  const Icon = health === "healthy" ? ShieldCheck : health === "watch" ? ShieldAlert : WifiOff;

  return (
    <section className={`rounded-lg border ${compact ? "px-2.5 py-1.5" : "px-3 py-2"} ${tone}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon size={15} />
          <div className="font-mono text-[10px] uppercase tracking-[0.14em]">Trust Status: {summary ? health : "loading"}</div>
        </div>
        {!compact && <div className="text-[10px] text-terminal-muted">When data is stale, missing, or conflicting, the terminal says so.</div>}
      </div>
      <div className={`${compact ? "mt-1 flex flex-wrap gap-1.5 text-[10px]" : "mt-2 grid gap-2 text-[11px] sm:grid-cols-4"}`}>
        <TrustMetric label="Stale" value={formatPct(summary?.staleRate)} />
        <TrustMetric label="Disagree" value={formatPct(summary?.disagreementRate)} />
        {!compact && <TrustMetric label="Cache" value={formatPct(summary?.cacheHitRate)} />}
        <TrustMetric label="Providers" value={summary ? compact ? `${summary.providerErrors}/${summary.providerMissing}/${summary.providerLimited}` : `${summary.providerErrors} err / ${summary.providerMissing} missing / ${summary.providerLimited} limited` : "loading"} />
      </div>
      {!compact && summary?.topWarnings?.length ? (
        <div className="mt-2 border-t border-current/20 pt-2 text-xs leading-relaxed">
          {summary.topWarnings[0]}
        </div>
      ) : null}
    </section>
  );
}

function TrustMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-current/20 bg-terminal-bg/35 px-1.5 py-0.5">
      <div className="text-[8px] uppercase tracking-[0.1em] opacity-70">{label}</div>
      <div className="font-mono text-[10px]">{value}</div>
    </div>
  );
}

function formatPct(value: number | null | undefined) {
  return typeof value === "number" ? `${(value * 100).toFixed(0)}%` : "N/A";
}
