"use client";

import type { DiscoveryFiltersState } from "@/lib/types";
import { Filter, RefreshCw, RotateCcw, Zap } from "lucide-react";

const PRESETS: Array<{ label: string; description: string; filters: DiscoveryFiltersState }> = [
  { label: "Balanced", description: "Liquid, active tokens.", filters: { minLiquidity: 25000, minVolume: 50000, maxAgeHours: 999999, riskLevel: "all" } },
  { label: "Fresh", description: "New pools only.", filters: { minLiquidity: 5000, minVolume: 10000, maxAgeHours: 24, riskLevel: "all" } },
  { label: "Quality", description: "Higher liquidity, lower noise.", filters: { minLiquidity: 100000, minVolume: 100000, maxAgeHours: 999999, riskLevel: "low" } }
];

export function DiscoveryFilters({
  filters,
  onChange,
  onRefresh
}: {
  filters: DiscoveryFiltersState;
  onChange: (filters: DiscoveryFiltersState) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-4 border-b border-terminal-border p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-terminal-muted">
            <Filter size={14} />
            Filters
          </div>
          <div className="mt-1 text-xs text-terminal-muted">Narrow the feed to tokens worth reviewing.</div>
        </div>
        <button onClick={onRefresh} className="rounded-lg border border-terminal-border bg-terminal-bg/70 p-2 text-terminal-muted transition hover:border-terminal-green hover:text-terminal-green hover:shadow-glow" title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="grid gap-2">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-terminal-muted">
          <Zap size={12} />
          Presets
        </div>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((preset) => {
            const active = filters.minLiquidity === preset.filters.minLiquidity && filters.minVolume === preset.filters.minVolume && filters.maxAgeHours === preset.filters.maxAgeHours && filters.riskLevel === preset.filters.riskLevel;
            return (
              <button key={preset.label} onClick={() => onChange(preset.filters)} title={preset.description} className={`rounded-lg border px-2 py-2 text-left transition ${active ? "border-terminal-green/50 bg-terminal-green/10 text-terminal-green" : "border-terminal-border bg-terminal-bg/55 text-terminal-muted hover:border-terminal-cyan/50 hover:text-terminal-cyan"}`}>
                <div className="font-mono text-[11px]">{preset.label}</div>
              </button>
            );
          })}
        </div>
      </div>
      <label className="block text-xs font-medium text-terminal-muted">
        Minimum liquidity
        <input className="mt-1.5 w-full rounded-lg border border-terminal-border bg-terminal-bg/75 px-3 py-2.5 font-mono text-terminal-text outline-none transition focus:border-terminal-cyan focus:ring-2 focus:ring-terminal-cyan/15" type="number" value={filters.minLiquidity} onChange={(event) => onChange({ ...filters, minLiquidity: Number(event.target.value) })} />
      </label>
      <label className="block text-xs font-medium text-terminal-muted">
        Minimum 24h volume
        <input className="mt-1.5 w-full rounded-lg border border-terminal-border bg-terminal-bg/75 px-3 py-2.5 font-mono text-terminal-text outline-none transition focus:border-terminal-cyan focus:ring-2 focus:ring-terminal-cyan/15" type="number" value={filters.minVolume} onChange={(event) => onChange({ ...filters, minVolume: Number(event.target.value) })} />
      </label>
      <label className="block text-xs font-medium text-terminal-muted">
        Max token age
        <select className="mt-1.5 w-full rounded-lg border border-terminal-border bg-terminal-bg/75 px-3 py-2.5 font-mono text-terminal-text outline-none transition focus:border-terminal-cyan focus:ring-2 focus:ring-terminal-cyan/15" value={filters.maxAgeHours} onChange={(event) => onChange({ ...filters, maxAgeHours: Number(event.target.value) })}>
          <option value={999999}>Any age</option>
          <option value={1}>1 hour</option>
          <option value={6}>6 hours</option>
          <option value={24}>24 hours</option>
          <option value={168}>7 days</option>
        </select>
      </label>
      <label className="block text-xs font-medium text-terminal-muted">
        Risk level
        <select className="mt-1.5 w-full rounded-lg border border-terminal-border bg-terminal-bg/75 px-3 py-2.5 font-mono text-terminal-text outline-none transition focus:border-terminal-cyan focus:ring-2 focus:ring-terminal-cyan/15" value={filters.riskLevel} onChange={(event) => onChange({ ...filters, riskLevel: event.target.value as DiscoveryFiltersState["riskLevel"] })}>
          <option value="all">All</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
      <button onClick={() => onChange(PRESETS[0].filters)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-terminal-border bg-terminal-bg/60 px-3 py-2 text-xs font-semibold text-terminal-muted transition hover:border-terminal-green/50 hover:text-terminal-green">
        <RotateCcw size={13} />
        Reset filters
      </button>
    </div>
  );
}
