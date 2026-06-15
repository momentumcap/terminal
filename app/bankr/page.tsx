"use client";

import { BankrAlertsFeed } from "@/components/bankr/BankrAlertsFeed";
import { BankrFilters } from "@/components/bankr/BankrFilters";
import { BankrLaunchDrawer } from "@/components/bankr/BankrLaunchDrawer";
import { BankrLaunchTable, type SortKey } from "@/components/bankr/BankrLaunchTable";
import { BetaDisclosure } from "@/components/beta/BetaDisclosure";
import { BetaReadinessBanner } from "@/components/beta/BetaReadinessBanner";
import { freshnessLabel, isStale, POLL_INTERVALS } from "@/lib/freshness";
import type { BankrAlert, BankrFiltersState, BankrLaunch, BankrLaunchVerdict } from "@/types/bankr";
import { Radar } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const defaultFilters: BankrFiltersState = {
  query: "",
  minLiquidity: 0,
  maxAgeMinutes: 1440,
  minCredibility: 0,
  riskLevel: "all",
  verdict: "all"
};

export default function BankrPage() {
  const [launches, setLaunches] = useState<BankrLaunch[]>([]);
  const [alerts, setAlerts] = useState<BankrAlert[]>([]);
  const [selected, setSelected] = useState<BankrLaunch | null>(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [sortKey, setSortKey] = useState<SortKey>("ageMinutes");
  const [status, setStatus] = useState("booting");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setStatus("syncing");
    setSyncError(null);
    try {
      const [launchResponse, alertResponse] = await Promise.all([
        fetch("/api/bankr/launches", { cache: "no-store" }).then((res) => res.json()),
        fetch("/api/bankr/alerts", { cache: "no-store" }).then((res) => res.json())
      ]);
      const nextLaunches: BankrLaunch[] = launchResponse.launches ?? [];
      setLaunches(nextLaunches);
      setAlerts(alertResponse.alerts ?? []);
      setSelected((current) => nextLaunches.find((launch) => launch.tokenAddress.toLowerCase() === current?.tokenAddress.toLowerCase()) ?? nextLaunches[0] ?? null);
      setLastSyncAt(launchResponse.servedAt ?? new Date().toISOString());
      setStatus("live");
    } catch {
      setSyncError("Bankr refresh failed; retaining last good launches");
      setStatus("stale");
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, POLL_INTERVALS.bankrMs);
    return () => window.clearInterval(interval);
  }, [load]);

  const stale = isStale(lastSyncAt, POLL_INTERVALS.bankrMs * 3);

  const filtered = useMemo(() => {
    const needle = filters.query.toLowerCase().trim();
    return launches
      .filter((launch) => {
        if (needle && !`${launch.creatorHandle ?? ""} ${launch.tokenSymbol} ${launch.tokenName} ${launch.tokenAddress}`.toLowerCase().includes(needle)) return false;
        if ((launch.liquidityUsd ?? 0) < filters.minLiquidity) return false;
        if (launch.ageMinutes > filters.maxAgeMinutes) return false;
        if (launch.credibilityScore < filters.minCredibility) return false;
        if (filters.riskLevel === "low" && launch.riskScore < 75) return false;
        if (filters.riskLevel === "medium" && (launch.riskScore < 45 || launch.riskScore >= 75)) return false;
        if (filters.riskLevel === "high" && launch.riskScore >= 45) return false;
        if (filters.verdict === "cleared" && launch.verdict !== "verified_alpha" && launch.verdict !== "watch") return false;
        if (filters.verdict !== "all" && filters.verdict !== "cleared" && launch.verdict !== filters.verdict) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortKey === "ageMinutes") {
          return new Date(b.launchedAt).getTime() - new Date(a.launchedAt).getTime();
        }
        return Number(b[sortKey] ?? 0) - Number(a[sortKey] ?? 0);
      });
  }, [filters, launches, sortKey]);

  useEffect(() => {
    if (!filtered.length) {
      setSelected(null);
      return;
    }
    if (!selected || !filtered.some((launch) => launch.tokenAddress.toLowerCase() === selected.tokenAddress.toLowerCase())) {
      setSelected(filtered[0]);
    }
  }, [filtered, selected]);

  const related = useMemo(() => {
    if (!selected?.creatorHandle) return [];
    return launches.filter((launch) => launch.creatorHandle === selected.creatorHandle && launch.tokenAddress !== selected.tokenAddress);
  }, [launches, selected]);

  return (
    <main className="grid min-h-screen grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3 bg-terminal-bg p-3 text-terminal-text lg:h-screen lg:grid-cols-[minmax(0,1fr)_390px] lg:grid-rows-[auto_auto_minmax(0,1fr)_auto]">
      <header className="border border-terminal-border bg-terminal-panel p-4 lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center border border-terminal-green/50 bg-terminal-green/10 text-terminal-green shadow-glow">
              <Radar size={22} />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-semibold">Bankr Launch Scanner</h1>
              <div className="text-xs text-terminal-muted">Live Bankr launch radar · Base chainId 8453 · {syncError ? "degraded" : stale ? "stale" : status} · synced {freshnessLabel(lastSyncAt)} · 20s polling</div>
            </div>
          </div>
          <Link href="/" className="border border-terminal-border px-3 py-2 font-mono text-xs text-terminal-muted transition hover:border-terminal-green hover:text-terminal-green">Back to Terminal</Link>
        </div>
        {syncError && <div className="mt-3 border border-terminal-amber/40 bg-terminal-amber/10 p-2 font-mono text-xs text-terminal-amber">{syncError}</div>}
        <div className="mt-3">
          <BetaReadinessBanner />
        </div>
        <div className="mt-3">
          <BetaDisclosure />
        </div>
        <div className="mt-3 grid gap-2 text-xs text-terminal-amber md:grid-cols-3">
          <div className="border border-terminal-amber/30 bg-terminal-amber/10 p-2">Credible creator does not mean safe token.</div>
          <div className="border border-terminal-amber/30 bg-terminal-amber/10 p-2">Bankr feed is unfiltered.</div>
          <div className="border border-terminal-amber/30 bg-terminal-amber/10 p-2">Always verify contract, liquidity, and sellability before trading.</div>
        </div>
        <div className="mt-3 grid gap-2 text-xs md:grid-cols-4">
          <VerdictCount label="Verified Alpha" verdict="verified_alpha" active={filters.verdict === "verified_alpha"} count={launches.filter((launch) => launch.verdict === "verified_alpha").length} tone="green" onClick={(verdict) => setFilters((current) => ({ ...current, verdict }))} />
          <VerdictCount label="Watch" verdict="watch" active={filters.verdict === "watch"} count={launches.filter((launch) => launch.verdict === "watch").length} tone="cyan" onClick={(verdict) => setFilters((current) => ({ ...current, verdict }))} />
          <VerdictCount label="Speculative" verdict="speculative" active={filters.verdict === "speculative"} count={launches.filter((launch) => launch.verdict === "speculative").length} tone="amber" onClick={(verdict) => setFilters((current) => ({ ...current, verdict }))} />
          <VerdictCount label="Blocked" verdict="blocked" active={filters.verdict === "blocked"} count={launches.filter((launch) => launch.verdict === "blocked").length} tone="red" onClick={(verdict) => setFilters((current) => ({ ...current, verdict }))} />
        </div>
      </header>

      <section className="lg:col-span-2">
        <BankrFilters filters={filters} onChange={setFilters} onRefresh={load} />
      </section>

      <section className="min-h-0">
        <BankrLaunchTable launches={filtered} selected={selected} sortKey={sortKey} onSort={setSortKey} onSelect={setSelected} />
      </section>
      <BankrLaunchDrawer launch={selected} related={related} />

      <section className="lg:col-span-2">
        <BankrAlertsFeed alerts={alerts} />
      </section>
    </main>
  );
}

function VerdictCount({
  label,
  verdict,
  count,
  tone,
  active,
  onClick
}: {
  label: string;
  verdict: BankrLaunchVerdict;
  count: number;
  tone: "green" | "cyan" | "amber" | "red";
  active: boolean;
  onClick: (verdict: BankrLaunchVerdict) => void;
}) {
  const color = {
    green: "border-terminal-green/30 text-terminal-green",
    cyan: "border-terminal-cyan/30 text-terminal-cyan",
    amber: "border-terminal-amber/30 text-terminal-amber",
    red: "border-terminal-red/30 text-terminal-red"
  }[tone];
  const activeColor = {
    green: "bg-terminal-green/10 shadow-[0_0_18px_rgba(67,209,122,0.18)]",
    cyan: "bg-terminal-cyan/10 shadow-[0_0_18px_rgba(76,201,240,0.16)]",
    amber: "bg-terminal-amber/10 shadow-[0_0_18px_rgba(245,158,11,0.14)]",
    red: "bg-terminal-red/10 shadow-[0_0_18px_rgba(255,82,82,0.14)]"
  }[tone];
  return (
    <button
      type="button"
      onClick={() => onClick(verdict)}
      className={`border p-2 text-left font-mono transition hover:bg-[#111923] ${color} ${active ? activeColor : "bg-[#0a0f16]"}`}
      aria-pressed={active}
      title={`Show ${label} launches`}
    >
      <span className={active ? "text-terminal-text" : "text-terminal-muted"}>{label}</span>
      <span className="float-right">{count}</span>
    </button>
  );
}
