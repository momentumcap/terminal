"use client";

export function SourceList({ sources }: { sources: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {sources.length ? sources.map((source) => <span key={source} className="border border-terminal-border px-2 py-0.5 font-mono text-[10px] text-terminal-muted">{source}</span>) : <span className="text-terminal-muted">No source</span>}
    </div>
  );
}
