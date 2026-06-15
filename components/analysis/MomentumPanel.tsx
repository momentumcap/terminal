"use client";

import type { MomentumMetrics } from "@/lib/analysis/types";
import { cn, formatPercent } from "@/lib/utils";
import { Activity, DatabaseZap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function MomentumPanel({ metrics }: { metrics: MomentumMetrics }) {
  const [transactionView, setTransactionView] = useState<"onchain" | "provider">(metrics.onchainTransactionWindows.length ? "onchain" : "provider");
  useEffect(() => {
    setTransactionView(metrics.onchainTransactionWindows.length ? "onchain" : "provider");
  }, [metrics.onchainTransactionWindows.length]);

  const activeWindows = transactionView === "onchain" ? metrics.onchainTransactionWindows : metrics.providerTransactionWindows;
  const hasRows = activeWindows.length > 0;
  const transactionChartSeries = activeWindows.map((window) => ({
    t: window.window,
    buys: window.buys ?? 0,
    sells: window.sells ?? 0
  }));
  const summary = useMemo(() => {
    const buys = activeWindows.reduce((sum, window) => sum + (window.buys ?? 0), 0);
    const sells = activeWindows.reduce((sum, window) => sum + (window.sells ?? 0), 0);
    const total = buys + sells;
    return { buys, sells, total, ratio: total ? buys / total : null };
  }, [activeWindows]);

  return (
    <section className="border border-terminal-border bg-terminal-panel p-4">
      <PanelTitle title="Momentum Analysis" />
      <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <ChartBox>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={metrics.priceSeries}>
              <CartesianGrid stroke="#1d2633" />
              <XAxis dataKey="t" stroke="#8190a5" />
              <YAxis stroke="#8190a5" width={52} />
              <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #1d2633" }} />
              <Area dataKey="price" stroke="#43d17a" fill="#43d17a22" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartBox>
        <ChartBox>
          <div className="mb-2 flex items-center justify-between px-1 text-[10px] uppercase tracking-[0.12em] text-terminal-muted">
            <span>Buy / Sell Pressure</span>
            <span className="font-mono text-terminal-text">{transactionView === "onchain" ? "Onchain" : "Provider"}</span>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={transactionChartSeries}>
              <CartesianGrid stroke="#1d2633" />
              <XAxis dataKey="t" stroke="#8190a5" />
              <YAxis stroke="#8190a5" width={52} />
              <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #1d2633" }} />
              <Bar dataKey="buys" fill="#43d17a" />
              <Bar dataKey="sells" fill="#ff5d5d" />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>
      </div>
      <MetricGrid items={[
        ["Breakout", `${metrics.breakoutProbability.toFixed(0)}`],
        ["Acceleration", `${metrics.acceleration.toFixed(0)}`],
        ["Buy Pressure", formatPercent(metrics.buyPressureRatio * 100)],
        ["Volatility", `${metrics.volatility.toFixed(0)}`],
        ["Consistency", `${metrics.trendConsistency.toFixed(0)}`],
        ["Sustained", `${metrics.sustainedMomentumScore.toFixed(0)}`]
      ]} />
      <div className="mt-3 border border-terminal-border bg-[#0a0f16]">
        <div className="flex flex-col gap-3 border-b border-terminal-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-terminal-muted">Observed Onchain / Provider Transactions</div>
            <div className="mt-1 font-mono text-xs text-terminal-text">
              {summary.total ? `${summary.buys} buys / ${summary.sells} sells` : "No transactions in selected feed"}
              <span className="ml-2 text-terminal-muted">{summary.ratio === null ? "" : `${formatPercent(summary.ratio * 100)} buy ratio`}</span>
            </div>
          </div>
          <div className="inline-flex w-full rounded-md border border-terminal-border bg-black/30 p-1 sm:w-auto">
            <TransactionToggleButton active={transactionView === "onchain"} disabled={!metrics.onchainTransactionWindows.length} onClick={() => setTransactionView("onchain")} icon={<DatabaseZap className="h-3.5 w-3.5" />} label="Onchain" badge={metrics.onchainTransactionWindows.length ? "BaseRPC" : "None"} />
            <TransactionToggleButton active={transactionView === "provider"} disabled={!metrics.providerTransactionWindows.length} onClick={() => setTransactionView("provider")} icon={<Activity className="h-3.5 w-3.5" />} label="Provider" badge={metrics.providerTransactionWindows[0]?.source ?? "API"} />
          </div>
        </div>
        <div className="grid grid-cols-5 gap-0 text-xs">
          <div className="border-b border-terminal-border p-2 text-terminal-muted">Window</div>
          <div className="border-b border-terminal-border p-2 text-terminal-muted">Buys</div>
          <div className="border-b border-terminal-border p-2 text-terminal-muted">Sells</div>
          <div className="border-b border-terminal-border p-2 text-terminal-muted">Buy Ratio</div>
          <div className="border-b border-terminal-border p-2 text-terminal-muted">Source</div>
          {hasRows ? activeWindows.map((window, index) => (
            <div key={`${transactionView}-${window.window}-${window.source}-${index}`} className="contents font-mono">
              <div className="border-b border-terminal-border/60 p-2">{window.window}</div>
              <div className="border-b border-terminal-border/60 p-2 text-terminal-green">{window.buys ?? "N/A"}</div>
              <div className="border-b border-terminal-border/60 p-2 text-terminal-red">{window.sells ?? "N/A"}</div>
              <div className="border-b border-terminal-border/60 p-2">{window.buyRatio === null ? "N/A" : formatPercent(window.buyRatio * 100)}</div>
              <div className="border-b border-terminal-border/60 p-2 text-terminal-muted">
                {window.source}{window.source === "BaseRPC" && window.complete ? " verified" : ""}
              </div>
            </div>
          )) : (
            <div className="col-span-5 border-b border-terminal-border/60 p-4 text-center text-xs text-terminal-muted">
              No {transactionView} transaction windows are available for this token yet.
            </div>
          )}
        </div>
        <div className="px-3 py-2 text-[11px] text-terminal-muted">
          {transactionView === "onchain"
            ? "Onchain counts come from Base RPC swap logs with timestamp-matched block windows. Only complete ranges are shown."
            : "Provider counts come from the current market data provider fields, usually DexScreener or GeckoTerminal."}
        </div>
      </div>
    </section>
  );
}

function TransactionToggleButton({ active, disabled, onClick, icon, label, badge }: { active: boolean; disabled?: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-1 items-center justify-center gap-2 rounded px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition sm:flex-none",
        active ? "bg-terminal-green text-black shadow-[0_0_18px_rgba(67,209,122,0.28)]" : "text-terminal-muted hover:bg-terminal-border/50 hover:text-terminal-text",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent hover:text-terminal-muted"
      )}
    >
      {icon}
      <span>{label}</span>
      <span className={cn("hidden rounded border px-1.5 py-0.5 font-mono text-[9px] tracking-normal sm:inline", active ? "border-black/30 text-black/70" : "border-terminal-border text-terminal-muted")}>{badge}</span>
    </button>
  );
}

export function PanelTitle({ title }: { title: string }) {
  return <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-terminal-muted">{title}</div>;
}

export function ChartBox({ children }: { children: React.ReactNode }) {
  return <div className="border border-terminal-border bg-[#0a0f16] p-2">{children}</div>;
}

export function MetricGrid({ items }: { items: Array<[string, string]> }) {
  return <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{items.map(([label, value]) => <div key={label} className="border border-terminal-border bg-[#0a0f16] p-2"><div className="text-[10px] uppercase tracking-[0.12em] text-terminal-muted">{label}</div><div className="mt-1 font-mono text-sm text-terminal-text">{value}</div></div>)}</div>;
}
