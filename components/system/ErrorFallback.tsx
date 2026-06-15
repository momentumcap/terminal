"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import Link from "next/link";

export function ErrorFallback({
  title = "Something interrupted this view",
  message = "Momentum Terminal caught the issue before it broke the whole session. Refresh this panel and keep going.",
  reset,
  showHome = true
}: {
  title?: string;
  message?: string;
  reset?: () => void;
  showHome?: boolean;
}) {
  return (
    <main className="min-h-screen bg-terminal-bg p-5 text-terminal-text">
      <section className="mx-auto flex min-h-[70vh] max-w-3xl items-center">
        <div className="w-full rounded-lg border border-terminal-red/40 bg-terminal-panel p-5 shadow-panel">
          <div className="flex gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-terminal-red/40 bg-terminal-red/10 text-terminal-red">
              <AlertTriangle size={22} />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-terminal-red">Controlled Recovery</div>
              <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
              <p className="mt-2 text-sm leading-relaxed text-terminal-muted">{message}</p>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-terminal-amber/30 bg-terminal-amber/10 p-3 text-sm text-terminal-amber">
            No token should be analyzed from a broken or partially rendered screen. If this happens repeatedly, check provider health and recent API errors in the accuracy dashboard.
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {reset && (
              <button onClick={reset} className="inline-flex items-center gap-2 rounded-lg border border-terminal-green/50 bg-terminal-green/10 px-4 py-2 font-mono text-xs uppercase tracking-[0.12em] text-terminal-green transition hover:bg-terminal-green/15">
                <RotateCcw size={14} />
                Try Again
              </button>
            )}
            {showHome && (
              <Link href="/" className="rounded-lg border border-terminal-border bg-terminal-bg/70 px-4 py-2 font-mono text-xs uppercase tracking-[0.12em] text-terminal-muted transition hover:border-terminal-cyan hover:text-terminal-cyan">
                Back To Terminal
              </Link>
            )}
            <Link href="/admin/accuracy" className="rounded-lg border border-terminal-border bg-terminal-bg/70 px-4 py-2 font-mono text-xs uppercase tracking-[0.12em] text-terminal-muted transition hover:border-terminal-amber hover:text-terminal-amber">
              Accuracy Dashboard
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
