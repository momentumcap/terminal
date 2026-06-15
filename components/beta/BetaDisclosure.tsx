"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import Link from "next/link";

export function BetaDisclosure({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-lg border border-terminal-amber/35 bg-terminal-amber/10 text-terminal-amber ${compact ? "px-3 py-2 text-xs" : "p-3 text-sm"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <AlertTriangle size={compact ? 14 : 16} />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em]">Public beta warning</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/status" className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] transition hover:text-terminal-text">
            Status <ExternalLink size={12} />
          </Link>
          <Link href="/feedback" className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] transition hover:text-terminal-text">
            Report Issue <ExternalLink size={12} />
          </Link>
          <Link href="/limitations" className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] transition hover:text-terminal-text">
            Limitations <ExternalLink size={12} />
          </Link>
        </div>
      </div>
      {!compact && (
        <p className="mt-2 leading-relaxed text-terminal-muted">
          Momentum Terminal is decision-support software, not financial advice. Metrics can be delayed, incomplete, estimated, or provider-conflicted. Always verify contract address, liquidity, holder data, and sellability before trading.
        </p>
      )}
    </div>
  );
}
