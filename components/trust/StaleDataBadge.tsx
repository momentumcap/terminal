"use client";

export function StaleDataBadge({ isStale }: { isStale: boolean }) {
  if (!isStale) return null;
  return <span className="inline-flex border border-terminal-muted/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-terminal-muted">stale</span>;
}
