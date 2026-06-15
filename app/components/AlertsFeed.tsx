"use client";

import type { Alert } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Bell, Radar } from "lucide-react";

export function AlertsFeed({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="h-full overflow-hidden rounded-lg bg-[#0c121b]">
      <div className="flex items-center justify-between border-b border-terminal-border px-4 py-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-terminal-muted">
          <Bell size={14} />
          Live Alerts
        </div>
        <div className="rounded-full border border-terminal-green/30 bg-terminal-green/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-terminal-green">Realtime</div>
      </div>
      <div className="flex h-[calc(100%-45px)] flex-col-reverse overflow-auto font-mono text-xs">
        {alerts.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-terminal-muted">
            <div className="max-w-md">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-terminal-green/35 bg-terminal-green/10 text-terminal-green">
                <Radar size={18} />
              </div>
              <div className="mt-3 font-semibold text-terminal-text">Monitoring for live signals</div>
              <div className="mt-1 leading-relaxed">Alerts appear when volume, flow, liquidity, breakout, or risk rules fire. A quiet feed means no rule has crossed threshold yet.</div>
            </div>
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={`${alert.id}-${alert.createdAt}`} className="grid grid-cols-[90px_110px_1fr] gap-3 border-b border-terminal-border/55 px-4 py-2.5 transition hover:bg-terminal-cyan/5">
              <span className="text-terminal-muted">{new Date(alert.createdAt).toLocaleTimeString()}</span>
              <span className={cn("uppercase", alert.severity === "critical" ? "text-terminal-red" : alert.severity === "warning" ? "text-terminal-amber" : "text-terminal-green")}>{alert.type.replaceAll("_", " ")}</span>
              <span><span className="text-terminal-cyan">{alert.symbol}</span> {alert.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
