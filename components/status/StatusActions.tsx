"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";

type RefreshState = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
  servedAt?: string;
  freshness?: any;
};

export function StatusActions() {
  const [state, setState] = useState<RefreshState>({
    status: "idle",
    message: "Run a fresh status check if the page looks stale or a provider was recently fixed."
  });

  async function refreshStatus() {
    setState({ status: "loading", message: "Checking live providers and trust summary..." });
    try {
      const response = await fetch("/api/status/refresh", { method: "POST", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message ?? "Refresh failed");
      setState({
        status: "success",
        message: data?.message ?? "Status refreshed.",
        servedAt: data?.servedAt,
        freshness: data?.freshness
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Status refresh failed."
      });
    }
  }

  return (
    <section className="rounded-lg border border-terminal-border bg-terminal-panel p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.14em] text-terminal-muted">Status Actions</div>
          <p className="mt-1 text-sm text-terminal-muted">{state.message}</p>
          {state.servedAt && <div className="mt-1 font-mono text-[11px] text-terminal-muted">Refreshed {state.servedAt}</div>}
        </div>
        <button
          onClick={refreshStatus}
          disabled={state.status === "loading"}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-terminal-cyan/45 bg-terminal-cyan/10 px-4 py-3 font-mono text-xs uppercase tracking-[0.12em] text-terminal-cyan transition hover:bg-terminal-cyan/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={14} className={state.status === "loading" ? "animate-spin" : ""} />
          Refresh Status
        </button>
      </div>
      {state.status === "success" && <div className="mt-3 rounded-lg border border-terminal-green/30 bg-terminal-green/10 p-3 text-xs text-terminal-green">Fresh check completed. Reload the page to render the updated server snapshot.</div>}
      {state.status === "error" && <div className="mt-3 rounded-lg border border-terminal-red/30 bg-terminal-red/10 p-3 text-xs text-terminal-red">{state.message}</div>}
      {state.freshness?.lastResult && (
        <div className="mt-3 grid gap-2 rounded-lg border border-terminal-border bg-terminal-bg/50 p-3 text-xs text-terminal-muted md:grid-cols-5">
          <Mini label="Auto freshness" value={state.freshness.enabled ? "running" : "manual"} />
          <Mini label="Trending" value={state.freshness.lastResult.trendingCount ?? 0} />
          <Mini label="New pools" value={state.freshness.lastResult.newCount ?? 0} />
          <Mini label="Bankr" value={state.freshness.lastResult.bankrCount ?? 0} />
          <Mini label="Market sampled" value={state.freshness.lastResult.marketSample?.sampledCount ?? 0} />
        </div>
      )}
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-terminal-muted">{label}</div>
      <div className="mt-1 font-mono text-terminal-text">{value}</div>
    </div>
  );
}
