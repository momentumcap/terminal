"use client";

import type { BankrFiltersState } from "@/types/bankr";
import { RefreshCw, Search } from "lucide-react";

export function BankrFilters({ filters, onChange, onRefresh }: { filters: BankrFiltersState; onChange: (filters: BankrFiltersState) => void; onRefresh: () => void }) {
  return (
    <div className="grid gap-2 border border-terminal-border bg-terminal-panel p-3 lg:grid-cols-[1fr_140px_140px_140px_130px_160px_auto]">
      <label className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-terminal-muted" size={16} />
        <input value={filters.query} onChange={(event) => onChange({ ...filters, query: event.target.value })} placeholder="creator, symbol, address" className="w-full border border-terminal-border bg-terminal-bg py-2 pl-9 pr-2 font-mono text-sm outline-none focus:border-terminal-green" />
      </label>
      <input type="number" value={filters.minLiquidity} onChange={(event) => onChange({ ...filters, minLiquidity: Number(event.target.value) })} className="border border-terminal-border bg-terminal-bg px-2 py-2 font-mono text-sm outline-none focus:border-terminal-green" aria-label="Minimum liquidity" />
      <select value={filters.maxAgeMinutes} onChange={(event) => onChange({ ...filters, maxAgeMinutes: Number(event.target.value) })} className="border border-terminal-border bg-terminal-bg px-2 py-2 font-mono text-sm outline-none focus:border-terminal-green" aria-label="Max age">
        <option value={1440}>24h</option>
        <option value={240}>4h</option>
        <option value={60}>1h</option>
        <option value={15}>15m</option>
      </select>
      <input type="number" value={filters.minCredibility} onChange={(event) => onChange({ ...filters, minCredibility: Number(event.target.value) })} className="border border-terminal-border bg-terminal-bg px-2 py-2 font-mono text-sm outline-none focus:border-terminal-green" aria-label="Minimum credibility" />
      <select value={filters.riskLevel} onChange={(event) => onChange({ ...filters, riskLevel: event.target.value as BankrFiltersState["riskLevel"] })} className="border border-terminal-border bg-terminal-bg px-2 py-2 font-mono text-sm outline-none focus:border-terminal-green" aria-label="Risk level">
        <option value="all">All risk</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
      <select value={filters.verdict} onChange={(event) => onChange({ ...filters, verdict: event.target.value as BankrFiltersState["verdict"] })} className="border border-terminal-border bg-terminal-bg px-2 py-2 font-mono text-sm outline-none focus:border-terminal-green" aria-label="Verdict">
        <option value="all">All verdicts</option>
        <option value="cleared">Cleared only</option>
        <option value="verified_alpha">Verified alpha</option>
        <option value="watch">Watch</option>
        <option value="speculative">Speculative</option>
        <option value="blocked">Blocked</option>
      </select>
      <button onClick={onRefresh} className="grid place-items-center border border-terminal-border px-3 text-terminal-muted transition hover:border-terminal-green hover:text-terminal-green" title="Refresh">
        <RefreshCw size={16} />
      </button>
    </div>
  );
}
