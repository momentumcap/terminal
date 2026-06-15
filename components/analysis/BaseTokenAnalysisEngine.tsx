"use client";

import { AnalysisReadinessPanel } from "@/components/analysis/AnalysisReadinessPanel";
import { BreakoutWatchPanel } from "@/components/analysis/BreakoutWatchPanel";
import { ExecutiveSummary } from "@/components/analysis/ExecutiveSummary";
import { HolderPanel } from "@/components/analysis/HolderPanel";
import { LiquidityPanel } from "@/components/analysis/LiquidityPanel";
import { LiveEventsFeed } from "@/components/analysis/LiveEventsFeed";
import { MomentumPanel } from "@/components/analysis/MomentumPanel";
import { NarrativePanel } from "@/components/analysis/NarrativePanel";
import { RiskPanel } from "@/components/analysis/RiskPanel";
import { SmartMoneyPanel } from "@/components/analysis/SmartMoneyPanel";
import { TacticalInterpretation } from "@/components/analysis/TacticalInterpretation";
import { TradeabilityPanel } from "@/components/analysis/TradeabilityPanel";
import { WalletGraph } from "@/components/analysis/WalletGraph";
import { freshnessLabel, isStale, POLL_INTERVALS } from "@/lib/freshness";
import type { TokenAnalysis } from "@/lib/analysis/types";
import { ArrowRight, Clipboard, Search, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const BASE_ADDRESS_PATTERN = /0x[a-fA-F0-9]{40}/;

function extractContractAddress(value: string) {
  return value.replace(/\u200B|\u200C|\u200D|\uFEFF/g, "").match(BASE_ADDRESS_PATTERN)?.[0] ?? value.trim();
}

export function BaseTokenAnalysisEngine({ selectedAddress }: { selectedAddress?: string | null }) {
  const [inputAddress, setInputAddress] = useState(selectedAddress ?? "");
  const [submittedAddress, setSubmittedAddress] = useState(selectedAddress ?? "");
  const [analysis, setAnalysis] = useState<TokenAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const inFlightRef = useRef(false);
  const analysisRef = useRef<TokenAnalysis | null>(null);

  useEffect(() => {
    analysisRef.current = analysis;
  }, [analysis]);

  useEffect(() => {
    if (selectedAddress) {
      setInputAddress(selectedAddress);
      setSubmittedAddress(selectedAddress);
    }
  }, [selectedAddress]);

  const load = useCallback(async (target: string, replaceCurrent = false) => {
    const cleanTarget = extractContractAddress(target);
    if (!cleanTarget) {
      if (replaceCurrent) {
        setAnalysis(null);
        setLastSyncAt(null);
      }
      setError("Paste a Base token contract address first.");
      return;
    }
    if (!BASE_ADDRESS_PATTERN.test(cleanTarget) || cleanTarget.length !== 42) {
      if (replaceCurrent) {
        setAnalysis(null);
        setLastSyncAt(null);
      }
      setError("That does not look like a full Base token contract address. It should start with 0x and be 42 characters long.");
      return;
    }
    if (inFlightRef.current && !replaceCurrent) return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    inFlightRef.current = true;
    setLoading(replaceCurrent || !analysisRef.current);
    if (replaceCurrent) {
      setAnalysis(null);
      setLastSyncAt(null);
    }
    setError(null);
    try {
      const response = await fetch(`/api/analysis/${encodeURIComponent(cleanTarget)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "analysis request failed");
      if (requestId !== requestIdRef.current) return;
      setAnalysis(data.analysis);
      setLastSyncAt(data.servedAt ?? data.analysis?.updatedAt ?? new Date().toISOString());
    } catch (caught) {
      if (requestId !== requestIdRef.current) return;
      setError(caught instanceof Error ? caught.message : "Analysis refresh failed. Retaining last good intelligence file.");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
      if (requestId === requestIdRef.current) inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!submittedAddress.trim()) {
      setLoading(false);
      return;
    }
    load(submittedAddress, true);
    const interval = window.setInterval(() => load(submittedAddress), POLL_INTERVALS.analysisMs);
    return () => window.clearInterval(interval);
  }, [submittedAddress, load]);

  const stale = isStale(lastSyncAt, POLL_INTERVALS.analysisMs * 3);
  const syncState = lastSyncAt ? stale ? "stale" : "live" : "waiting for address";

  return (
    <div className="min-h-screen overflow-auto bg-terminal-bg p-3 text-terminal-text md:p-5">
      <header className="mb-4 flex flex-col gap-3 border border-terminal-border bg-terminal-panel p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center border border-terminal-green/50 bg-terminal-green/10 text-terminal-green shadow-glow">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="font-mono text-xl font-semibold">Base Token Analysis Engine</h1>
            <div className="text-xs text-terminal-muted">Base chainId 8453 · synced {freshnessLabel(lastSyncAt)} · {syncState} · BaseRPC windows preferred</div>
          </div>
        </div>
        <form
          className="flex min-w-0 flex-1 gap-2 lg:max-w-xl"
          onSubmit={(event) => {
            event.preventDefault();
            const cleanAddress = extractContractAddress(inputAddress);
            setInputAddress(cleanAddress);
            setSubmittedAddress(cleanAddress);
            if (cleanAddress === submittedAddress) load(cleanAddress, true);
          }}
        >
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-muted" size={17} />
            <input
              value={inputAddress}
              onChange={(event) => setInputAddress(event.target.value)}
              onPaste={(event) => {
                const pasted = event.clipboardData.getData("text");
                const cleanAddress = extractContractAddress(pasted);
                if (cleanAddress !== pasted.trim()) {
                  event.preventDefault();
                  setInputAddress(cleanAddress);
                }
              }}
              placeholder="Paste Base token contract address"
              className="w-full border border-terminal-border bg-terminal-bg py-3 pl-10 pr-3 font-mono text-sm outline-none transition focus:border-terminal-green"
            />
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                const text = await navigator.clipboard.readText();
                const cleanAddress = extractContractAddress(text);
                setInputAddress(cleanAddress);
                setSubmittedAddress(cleanAddress);
                load(cleanAddress, true);
              } catch {
                setError("Clipboard access was blocked. Click the box, paste the contract address, then press Analyze.");
              }
            }}
            className="hidden items-center gap-2 border border-terminal-border px-3 py-3 font-mono text-xs uppercase tracking-[0.12em] text-terminal-muted transition hover:border-terminal-cyan hover:text-terminal-cyan sm:inline-flex"
          >
            <Clipboard size={14} />
            Paste
          </button>
          <button type="submit" className="inline-flex items-center gap-2 border border-terminal-green/50 px-4 py-3 font-mono text-xs uppercase tracking-[0.12em] text-terminal-green transition hover:bg-terminal-green/10">
            Analyze
            <ArrowRight size={14} />
          </button>
        </form>
      </header>

      {loading && <LoadingState />}
      {error && <div className="mb-3 border border-terminal-amber/50 bg-terminal-amber/10 p-3 font-mono text-xs text-terminal-amber">{error}</div>}
      {!loading && !analysis && <EmptyState />}
      {analysis && !loading && (
        <div className="grid gap-4">
          <ExecutiveSummary analysis={analysis} />
          <AnalysisReadinessPanel analysis={analysis} />
          <TacticalInterpretation summary={analysis.tacticalSummary} />
          <BreakoutWatchPanel metrics={analysis.breakoutWatch} />
          <div className="grid gap-4 2xl:grid-cols-2">
            <MomentumPanel metrics={analysis.momentum} />
            <LiquidityPanel metrics={analysis.liquidity} />
            <HolderPanel metrics={analysis.holders} tokenAddress={analysis.address} />
            <SmartMoneyPanel metrics={analysis.smartMoney} />
            <RiskPanel risk={analysis.risk} deployer={analysis.deployer} manipulation={analysis.manipulation} />
            <WalletGraph clusters={analysis.clusters} />
            <NarrativePanel metrics={analysis.narrative} />
            <TradeabilityPanel metrics={analysis.tradeability} />
          </div>
          <LiveEventsFeed events={analysis.liveEvents} />
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <section className="border border-terminal-border bg-terminal-panel p-6">
      <div className="max-w-3xl">
        <div className="text-[10px] uppercase tracking-[0.18em] text-terminal-muted">Ready for your token</div>
        <h2 className="mt-2 font-mono text-2xl font-semibold text-terminal-text">Paste a Base contract address to begin.</h2>
        <div className="mt-4 grid gap-3 text-sm text-terminal-muted md:grid-cols-3">
          <div className="border border-terminal-border bg-[#0a0f16] p-4">
            <div className="font-mono text-terminal-green">1. Copy</div>
            <p className="mt-2">Find the token contract address. It starts with <span className="font-mono text-terminal-text">0x</span>.</p>
          </div>
          <div className="border border-terminal-border bg-[#0a0f16] p-4">
            <div className="font-mono text-terminal-green">2. Paste</div>
            <p className="mt-2">Click the search box above and paste the whole address.</p>
          </div>
          <div className="border border-terminal-border bg-[#0a0f16] p-4">
            <div className="font-mono text-terminal-green">3. Press Analyze</div>
            <p className="mt-2">We will check price, buys, sells, liquidity, risk, and live signals.</p>
          </div>
        </div>
        <div className="mt-4 border border-terminal-amber/30 bg-terminal-amber/10 p-3 text-xs text-terminal-amber">
          Use the exact Base token contract address. Do not paste a token name, symbol, or wallet address.
        </div>
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-3">
      <div className="h-40 animate-pulse border border-terminal-border bg-terminal-panel" />
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="h-64 animate-pulse border border-terminal-border bg-terminal-panel" />
        <div className="h-64 animate-pulse border border-terminal-border bg-terminal-panel" />
      </div>
    </div>
  );
}
