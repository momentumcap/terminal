"use client";

import type { TokenWithScores, WatchlistEntry } from "@/lib/types";
import { Check, Plus, Star } from "lucide-react";

export function WatchlistPanel({
  watchlist,
  selected,
  onSelect,
  onAdd
}: {
  watchlist: WatchlistEntry[];
  selected: TokenWithScores | null;
  onSelect: (address: string) => void;
  onAdd: () => void;
}) {
  const selectedSaved = Boolean(selected && watchlist.some((entry) => entry.tokenAddress.toLowerCase() === selected.tokenAddress.toLowerCase()));
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-terminal-muted">
            <Star size={14} />
            Watchlist
          </div>
          <div className="mt-1 text-xs text-terminal-muted">Keep promising tokens close.</div>
        </div>
        <button onClick={onAdd} disabled={!selected || selectedSaved} className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${selectedSaved ? "border-terminal-green/35 bg-terminal-green/10 text-terminal-green" : "border-terminal-border bg-terminal-bg/70 text-terminal-muted hover:border-terminal-green hover:text-terminal-green"}`}>
          {selectedSaved ? <Check size={12} /> : <Plus size={12} />}
          {selectedSaved ? "Saved" : "Add"}
        </button>
      </div>
      {selected && (
        <div className="rounded-lg border border-terminal-border bg-terminal-bg/45 p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-terminal-muted">Selected</div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-mono text-sm text-terminal-text">{selected.symbol}</div>
              <div className="truncate font-mono text-[10px] text-terminal-muted">{selected.tokenAddress}</div>
            </div>
            <div className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${selected.riskLevel === "low" ? "border-terminal-green/30 text-terminal-green" : selected.riskLevel === "medium" ? "border-terminal-amber/30 text-terminal-amber" : "border-terminal-red/30 text-terminal-red"}`}>{selected.riskLevel}</div>
          </div>
        </div>
      )}
      <div className="space-y-1">
        {watchlist.length === 0 ? (
          <div className="rounded-lg border border-dashed border-terminal-border bg-terminal-bg/40 p-3 text-xs leading-relaxed text-terminal-muted">
            <div className="font-semibold text-terminal-text">No saved tokens yet</div>
            <div className="mt-1">Select a token from the feed, review its confidence and liquidity, then press Add to keep it here.</div>
          </div>
        ) : (
          watchlist.map((entry) => (
            <button key={entry.tokenAddress} onClick={() => onSelect(entry.tokenAddress)} className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition hover:border-terminal-green hover:bg-terminal-green/5 ${selected?.tokenAddress.toLowerCase() === entry.tokenAddress.toLowerCase() ? "border-terminal-green/50 bg-terminal-green/10" : "border-terminal-border bg-terminal-bg/55"}`}>
              <span className="min-w-0">
                <span className="block truncate font-mono text-sm text-terminal-text">{entry.symbol}</span>
                <span className="block truncate font-mono text-[10px] text-terminal-muted">saved {new Date(entry.createdAt).toLocaleDateString()}</span>
              </span>
              <span className="font-mono text-[10px] text-terminal-muted">{entry.tokenAddress.slice(0, 6)}...{entry.tokenAddress.slice(-4)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
