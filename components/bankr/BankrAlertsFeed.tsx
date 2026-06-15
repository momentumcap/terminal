"use client";

import type { BankrAlert } from "@/types/bankr";

export function BankrAlertsFeed({ alerts }: { alerts: BankrAlert[] }) {
  return (
    <section className="border border-terminal-border bg-terminal-panel">
      <div className="border-b border-terminal-border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-terminal-muted">Bankr Live Alerts</div>
      <div className="max-h-48 overflow-auto font-mono text-xs">
        {alerts.length === 0 ? <div className="p-4 text-terminal-muted">No launch alerts yet.</div> : alerts.map((alert, index) => (
          <div key={`${alert.id}-${alert.createdAt}-${index}`} className="grid grid-cols-[86px_130px_1fr] gap-3 border-b border-terminal-border/70 px-4 py-2">
            <span className="text-terminal-muted">{new Date(alert.createdAt).toLocaleTimeString()}</span>
            <span className={alert.severity === "alpha" ? "text-terminal-green" : alert.severity === "danger" ? "text-terminal-red" : "text-terminal-amber"}>{alert.type}</span>
            <span><span className="text-terminal-cyan">{alert.tokenSymbol}</span> {alert.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
