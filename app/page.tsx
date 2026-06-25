"use client";

import { AlertsFeed } from "@/app/components/AlertsFeed";
import { DiscoveryFilters } from "@/app/components/DiscoveryFilters";
import { TokenDetailPanel } from "@/app/components/TokenDetailPanel";
import { TokenTable } from "@/app/components/TokenTable";
import { WatchlistPanel } from "@/app/components/WatchlistPanel";
import { BaseTokenAnalysisEngine } from "@/components/analysis/BaseTokenAnalysisEngine";
import { BetaDisclosure } from "@/components/beta/BetaDisclosure";
import { BetaReadinessBanner } from "@/components/beta/BetaReadinessBanner";
import { TrustStatusStrip } from "@/components/trust/TrustStatusStrip";
import { freshnessLabel, isStale, POLL_INTERVALS } from "@/lib/freshness";
import type { Alert, DiscoveryFiltersState, TokenWithScores, WatchlistEntry } from "@/lib/types";
import { Activity, BarChart3, Database, Search, Sparkles, Wifi } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const defaultFilters: DiscoveryFiltersState = {
  minLiquidity: 25000,
  minVolume: 50000,
  maxAgeHours: 999999,
  riskLevel: "all"
};

export default function Home() {
  const [tokens, setTokens] = useState<TokenWithScores[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [selected, setSelected] = useState<TokenWithScores | null>(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"trending" | "new">("trending");
  const [workspace, setWorkspace] = useState<"terminal" | "analysis">("terminal");
  const [analysisAddress, setAnalysisAddress] = useState<string | null>(null);
  const [status, setStatus] = useState("booting");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState("pending source");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [sourceWarnings, setSourceWarnings] = useState<string[]>([]);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    setHasHydrated(true);
    const params = new URLSearchParams(window.location.search);
    const address = params.get("analysis");
    if (params.has("analysis")) {
      setAnalysisAddress(address || null);
      setWorkspace("analysis");
    }
  }, []);

  const load = useCallback(async () => {
    if (!hasHydrated) return;
    if (workspace !== "terminal") return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setStatus("syncing");
    setSyncError(null);
    const endpoint = query.trim() ? `/api/tokens/search?q=${encodeURIComponent(query.trim())}` : `/api/tokens/${mode}`;
    try {
      const tokenResponse = await fetch(endpoint, { cache: "no-store" }).then((res) => res.json());
      const nextTokens: TokenWithScores[] = tokenResponse.tokens ?? [];
      setTokens(nextTokens);
      setSelected((current) => nextTokens.find((token) => token.tokenAddress.toLowerCase() === current?.tokenAddress.toLowerCase()) ?? nextTokens[0] ?? null);
      setLastSyncAt(tokenResponse.servedAt ?? new Date().toISOString());
      setSourceLabel(tokenResponse.source ?? "live-public-api");
      setSourceWarnings(tokenResponse.warnings ?? []);
      setHasLoadedOnce(true);
      setStatus("live");

      const [alertResponse, watchlistResponse] = await Promise.allSettled([
        fetch("/api/alerts", { cache: "no-store" }).then((res) => res.json()),
        fetch("/api/watchlist", { cache: "no-store" }).then((res) => res.json())
      ]);
      if (alertResponse.status === "fulfilled") setAlerts(alertResponse.value.alerts ?? []);
      if (watchlistResponse.status === "fulfilled") setWatchlist(watchlistResponse.value.watchlist ?? []);
    } catch {
      setSyncError("last sync failed");
      setSourceWarnings(["Latest sync failed. Displayed data may be stale until the next successful provider response."]);
      setHasLoadedOnce(true);
      setStatus("stale");
    } finally {
      inFlightRef.current = false;
    }
  }, [hasHydrated, mode, query, workspace]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (workspace !== "terminal") return;
    load();
    const interval = window.setInterval(load, POLL_INTERVALS.terminalMs);
    return () => window.clearInterval(interval);
  }, [hasHydrated, load, workspace]);

  const stale = isStale(lastSyncAt, POLL_INTERVALS.terminalMs * 3);
  const healthLabel = syncError ? "sync degraded" : stale ? "stale" : status;
  const tableLoading = !hasLoadedOnce && status === "syncing";
  const emptyReason = syncError || (hasLoadedOnce && !tokens.length) ? "sync" : "filters";

  const filteredTokens = useMemo(() => {
    return tokens.filter((token) => {
      if ((token.liquidityUsd ?? 0) < filters.minLiquidity) return false;
      if ((token.volume24h ?? 0) < filters.minVolume) return false;
      if (token.ageHours !== null && token.ageHours > filters.maxAgeHours) return false;
      if (filters.riskLevel !== "all" && token.riskLevel !== filters.riskLevel) return false;
      return true;
    });
  }, [filters, tokens]);

  const addWatchlist = async () => {
    if (!selected) return;
    const response = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tokenAddress: selected.tokenAddress, symbol: selected.symbol })
    });
    const data = await response.json();
    setWatchlist(data.watchlist ?? []);
  };

  const selectWatchlist = (address: string) => {
    const token = tokens.find((item) => item.tokenAddress.toLowerCase() === address.toLowerCase());
    if (token) setSelected(token);
  };

  const analyzeToken = (address: string) => {
    setAnalysisAddress(address);
    setWorkspace("analysis");
    window.history.replaceState(null, "", `/?analysis=${address}`);
  };

  if (workspace === "analysis") {
    return (
      <div className="min-h-screen bg-terminal-bg">
        <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-terminal-border bg-terminal-panel/95 px-4 py-3 shadow-panel backdrop-blur">
          <button onClick={() => setWorkspace("terminal")} className="rounded-lg border border-terminal-border bg-terminal-bg/70 px-3 py-2 text-xs font-semibold text-terminal-muted transition hover:border-terminal-green hover:text-terminal-green">
            Back to Terminal
          </button>
        <div className="min-w-[260px] flex-1"><TrustStatusStrip compact /></div>
        <BetaDisclosure compact />
        <div className="text-xs text-terminal-muted">Analysis Engine · exact-address mode · 30s adaptive polling</div>
        </div>
        <BaseTokenAnalysisEngine selectedAddress={analysisAddress} />
      </div>
    );
  }

  return (
    <main className="grid min-h-screen grid-cols-1 gap-3 bg-terminal-bg p-3 text-terminal-text xl:h-screen xl:grid-cols-[300px_minmax(0,1fr)_390px] xl:grid-rows-[auto_minmax(0,1fr)_220px] xl:overflow-hidden">
      <header className="rounded-lg border border-terminal-border bg-terminal-panel/95 px-3 py-2.5 shadow-panel backdrop-blur xl:col-span-3">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
        <div className="flex min-w-[260px] items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg border border-terminal-green/50 bg-terminal-green/10 text-terminal-green shadow-glow">
            <Activity size={21} />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-wide">Momentum Terminal</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-terminal-muted">
              <Wifi size={12} className="text-terminal-green" />
              <span>Base L2</span>
              <span className="hidden sm:inline">chainId 8453</span>
              <span className="rounded-full border border-terminal-green/25 bg-terminal-green/10 px-2 py-0.5 text-terminal-green">{healthLabel}</span>
              <span>synced {freshnessLabel(lastSyncAt)}</span>
            </div>
          </div>
        </div>

        <form
          className="relative flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            load();
          }}
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-muted" size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search token symbol or paste a contract address" className="h-10 w-full rounded-lg border border-terminal-border bg-terminal-bg/80 py-2 pl-10 pr-3 text-sm outline-none transition placeholder:text-terminal-muted focus:border-terminal-cyan focus:ring-2 focus:ring-terminal-cyan/15" />
        </form>

        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <button onClick={() => setMode("trending")} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 transition ${mode === "trending" ? "border-terminal-green/50 bg-terminal-green/15 text-terminal-green" : "border-terminal-border bg-terminal-bg/60 text-terminal-muted hover:border-terminal-cyan/50 hover:text-terminal-cyan"}`}>
            <BarChart3 size={14} />
            Trending
          </button>
          <button onClick={() => setMode("new")} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 transition ${mode === "new" ? "border-terminal-green/50 bg-terminal-green/15 text-terminal-green" : "border-terminal-border bg-terminal-bg/60 text-terminal-muted hover:border-terminal-cyan/50 hover:text-terminal-cyan"}`}>
            <Sparkles size={14} />
            New Pools
          </button>
          <button onClick={() => { setAnalysisAddress(null); setWorkspace("analysis"); }} className="inline-flex items-center gap-2 rounded-lg border border-terminal-border bg-terminal-bg/60 px-3 py-2 text-terminal-cyan transition hover:border-terminal-cyan/50 hover:bg-terminal-cyan/10">
            <Database size={14} />
            Analysis
          </button>
          <Link href="/bankr" className="inline-flex items-center gap-2 rounded-lg border border-terminal-border bg-terminal-bg/60 px-3 py-2 text-terminal-green transition hover:border-terminal-green/50 hover:bg-terminal-green/10">
            Bankr Launches
          </Link>
        </div>
        <div className={`max-w-full truncate rounded-lg border px-3 py-2 text-[10px] uppercase tracking-[0.12em] xl:max-w-[260px] ${stale || syncError || sourceWarnings.length ? "border-terminal-amber/40 bg-terminal-amber/10 text-terminal-amber" : "border-terminal-green/40 bg-terminal-green/10 text-terminal-green"}`}>
          {sourceLabel}
        </div>
        </div>
        <div className="mt-2 grid gap-2 lg:grid-cols-[1fr_1fr_auto]">
          <TrustStatusStrip compact />
          <BetaReadinessBanner compact />
          <BetaDisclosure compact />
        </div>
      </header>

      {syncError && <div className="fixed right-4 top-20 z-40 rounded-lg border border-terminal-amber/40 bg-terminal-amber/10 px-3 py-2 text-xs text-terminal-amber shadow-panel">{syncError}; retaining last good data</div>}
      {sourceWarnings.length > 0 && !syncError && (
        <div className="fixed right-4 top-20 z-40 max-w-md rounded-lg border border-terminal-amber/40 bg-terminal-amber/10 px-3 py-2 text-xs text-terminal-amber shadow-panel">
          {sourceWarnings[0]}
        </div>
      )}

      <section className="rounded-lg border border-terminal-border bg-terminal-panel/95 shadow-panel xl:row-span-2 xl:min-h-0 xl:overflow-auto">
        <DiscoveryFilters filters={filters} onChange={setFilters} onRefresh={load} />
        <WatchlistPanel watchlist={watchlist} selected={selected} onSelect={selectWatchlist} onAdd={addWatchlist} />
      </section>

      <section className="min-h-[520px] rounded-lg border border-terminal-border bg-terminal-panel/70 shadow-panel xl:min-h-0">
        <TokenTable tokens={filteredTokens} selectedAddress={selected?.tokenAddress ?? null} onSelect={setSelected} loading={tableLoading} emptyReason={emptyReason} />
      </section>

      <TokenDetailPanel token={selected} onAnalyze={analyzeToken} />

      <section className="min-h-[220px] rounded-lg border border-terminal-border bg-terminal-panel/80 shadow-panel xl:col-start-2 xl:col-end-4 xl:min-h-0">
        <AlertsFeed alerts={alerts} />
      </section>
    </main>
  );
}
