"use client";

import { ChartBox, PanelTitle } from "@/components/analysis/MomentumPanel";
import type { BreakoutWatchMetrics } from "@/lib/analysis/types";
import { cn, formatPercent, formatUsd } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, Crosshair, Radar, ShieldAlert, Target } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function BreakoutWatchPanel({ metrics }: { metrics: BreakoutWatchMetrics }) {
  const tone = metrics.probabilityScore >= 75
    ? "border-terminal-green/45 bg-terminal-green/10 text-terminal-green"
    : metrics.probabilityScore >= 60
      ? "border-terminal-cyan/45 bg-terminal-cyan/10 text-terminal-cyan"
      : metrics.probabilityScore >= 40
        ? "border-terminal-amber/45 bg-terminal-amber/10 text-terminal-amber"
        : "border-terminal-border bg-terminal-bg/40 text-terminal-muted";
  const bars = [
    { name: "Volume", value: metrics.volumeAccelerationScore },
    { name: "Buy flow", value: metrics.buyPressureTrendScore },
    { name: "Compress", value: metrics.priceCompressionScore },
    { name: "Retest", value: metrics.resistanceRetestScore },
    { name: "Liquidity", value: metrics.liquiditySupportScore },
    { name: "Holders", value: metrics.holderExpansionScore },
    { name: "Wallets", value: metrics.smartWalletInflowScore },
    { name: "Social", value: metrics.socialMomentumScore },
    { name: "Risk drag", value: metrics.riskPenaltyScore, penalty: true }
  ];

  return (
    <section className="border border-terminal-border bg-terminal-panel p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <PanelTitle title="Breakout Watch" />
        <div className={cn("inline-flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-xs uppercase tracking-[0.12em]", tone)}>
          <Radar size={14} />
          {metrics.status}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="border border-terminal-border bg-[#0a0f16] p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-terminal-muted">Probability of Setup</div>
              <div className="mt-2 font-mono text-5xl font-semibold text-terminal-text">{metrics.probabilityScore}</div>
              <div className="mt-2 text-xs text-terminal-muted">Confidence: <span className={confidenceClass(metrics.confidence)}>{metrics.confidence}</span></div>
            </div>
            <div className="grid h-16 w-16 place-items-center rounded-full border border-current/35 bg-current/10">
              {metrics.probabilityScore >= 60 ? <Target size={26} /> : <Crosshair size={26} />}
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-terminal-muted">{metrics.explanation}</p>
          <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
            <MiniMetric label="Current" value={formatUsd(metrics.currentPriceUsd, 6)} />
            <MiniMetric label="Resistance" value={formatUsd(metrics.resistanceLevelUsd, 6)} tone="green" />
            <MiniMetric label="Support" value={formatUsd(metrics.supportLevelUsd, 6)} tone="amber" />
            <MiniMetric label="Distance" value={metrics.distanceToResistancePct === null ? "N/A" : formatPercent(metrics.distanceToResistancePct)} />
          </div>
        </div>

        <ChartBox>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={bars}>
              <CartesianGrid stroke="#1d2633" />
              <XAxis dataKey="name" stroke="#8190a5" tick={{ fontSize: 10 }} />
              <YAxis stroke="#8190a5" width={36} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "#0d1117", border: "1px solid #1d2633" }} />
              <Bar dataKey="value">
                {bars.map((bar) => (
                  <Cell key={bar.name} fill={bar.penalty ? "#ff5d5d" : bar.value >= 65 ? "#43d17a" : bar.value >= 45 ? "#f7c948" : "#43c6db"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <SignalList icon={<CheckCircle2 size={14} />} title="Boosts" items={metrics.boosts} empty="No strong breakout boosts yet." tone="green" />
        <SignalList icon={<AlertTriangle size={14} />} title="Penalties" items={metrics.penalties} empty="No major penalties detected from available inputs." tone="amber" />
        <SignalList icon={<ShieldAlert size={14} />} title="Missing Data" items={metrics.missingData} empty="No critical missing-data notes in this refresh." tone="muted" />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <TriggerList title="Confirmation Triggers" items={metrics.confirmationTriggers} />
        <TriggerList title="Invalidation Triggers" items={metrics.invalidationTriggers} danger />
      </div>
    </section>
  );
}

function MiniMetric({ label, value, tone = "text" }: { label: string; value: string; tone?: "text" | "green" | "amber" }) {
  return (
    <div className="border border-terminal-border bg-terminal-bg/50 p-2">
      <div className="text-[9px] uppercase tracking-[0.12em] text-terminal-muted">{label}</div>
      <div className={cn("mt-1 font-mono text-sm", tone === "green" ? "text-terminal-green" : tone === "amber" ? "text-terminal-amber" : "text-terminal-text")}>{value}</div>
    </div>
  );
}

function SignalList({ icon, title, items, empty, tone }: { icon: React.ReactNode; title: string; items: string[]; empty: string; tone: "green" | "amber" | "muted" }) {
  return (
    <div className="border border-terminal-border bg-[#0a0f16] p-3">
      <div className={cn("flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em]", tone === "green" ? "text-terminal-green" : tone === "amber" ? "text-terminal-amber" : "text-terminal-muted")}>
        {icon}
        {title}
      </div>
      <div className="mt-3 space-y-2 text-xs text-terminal-muted">
        {(items.length ? items : [empty]).slice(0, 4).map((item) => (
          <div key={item} className="border-l border-terminal-border pl-2 leading-relaxed">{item}</div>
        ))}
      </div>
    </div>
  );
}

function TriggerList({ title, items, danger = false }: { title: string; items: string[]; danger?: boolean }) {
  return (
    <div className="border border-terminal-border bg-[#0a0f16] p-3">
      <div className={cn("font-mono text-[10px] uppercase tracking-[0.14em]", danger ? "text-terminal-red" : "text-terminal-green")}>{title}</div>
      <div className="mt-3 grid gap-2 text-xs text-terminal-muted sm:grid-cols-2">
        {items.map((item) => (
          <div key={item} className="rounded-md border border-terminal-border bg-terminal-bg/45 p-2 leading-relaxed">{item}</div>
        ))}
      </div>
    </div>
  );
}

function confidenceClass(confidence: BreakoutWatchMetrics["confidence"]) {
  return confidence === "high" ? "text-terminal-green" : confidence === "medium" ? "text-terminal-amber" : "text-terminal-red";
}
