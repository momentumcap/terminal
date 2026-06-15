"use client";

import { CredibilityBadge } from "@/components/bankr/CredibilityBadge";
import { formatUsd } from "@/lib/utils";
import type { BankrLaunch } from "@/types/bankr";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

export function BankrLaunchDrawer({ launch, related }: { launch: BankrLaunch | null; related: BankrLaunch[] }) {
  if (!launch) return <aside className="border border-terminal-border bg-terminal-panel p-5 text-terminal-muted">Select a launch to inspect creator, alpha, risk, and market context.</aside>;
  const dexUrl = launch.dexPairAddress ? `https://dexscreener.com/base/${launch.dexPairAddress}` : `https://dexscreener.com/base/${launch.tokenAddress}`;
  const geckoUrl = launch.dexPairAddress ? `https://www.geckoterminal.com/base/pools/${launch.dexPairAddress}` : `https://www.geckoterminal.com/base/tokens/${launch.tokenAddress}`;
  const bankrUrl = `https://bankr.bot/launches/${launch.tokenAddress}`;
  return (
    <aside className="max-h-[calc(100vh-160px)] overflow-auto border border-terminal-border bg-terminal-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-2xl font-semibold">{launch.tokenSymbol}</div>
          <div className="text-sm text-terminal-muted">{launch.tokenName}</div>
          <div className={`mt-2 inline-flex border px-2 py-1 font-mono text-[10px] uppercase ${verdictTone(launch.verdict)}`}>{launch.verdict.replace("_", " ")}</div>
        </div>
        <CredibilityBadge score={launch.credibilityScore} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Metric label="Liquidity" value={formatUsd(launch.liquidityUsd, 1)} />
        <Metric label="FDV" value={formatUsd(launch.fdv, 1)} />
        <Metric label="Vol 5m" value={formatUsd(launch.volume5m, 1)} />
        <Metric label="Vol 1h" value={formatUsd(launch.volume1h, 1)} />
        <Metric label="Opportunity" value={String(launch.opportunityScore)} />
        <Metric label="Risk Safety" value={String(launch.riskScore)} />
      </div>
      <Section title="Creator">
        <div className="text-sm">@{launch.creatorHandle ?? "unknown"} · {launch.creatorName ?? "Unknown"}</div>
        <div className="text-xs text-terminal-muted">{launch.creatorFollowers?.toLocaleString() ?? "N/A"} followers · {launch.creatorVerified ? "verified" : "unverified"} · tier {launch.creatorTier}</div>
        {launch.creatorProfileUrl && <a className="mt-2 inline-flex items-center gap-2 text-xs text-terminal-cyan" href={launch.creatorProfileUrl} target="_blank" rel="noreferrer">Open X profile <ExternalLink size={13} /></a>}
      </Section>
      <Section title="Verdict Gates">
        <div className="mb-2 text-xs text-terminal-muted">{launch.verdictReason}</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {Object.entries(launch.gateChecks).map(([key, value]) => <div key={key} className={`border p-2 font-mono ${value ? "border-terminal-green/40 text-terminal-green" : "border-terminal-amber/40 text-terminal-amber"}`}>{key}: {value ? "pass" : "pending"}</div>)}
        </div>
      </Section>
      <Section title="Launch Post">
        <p className="text-sm leading-6">{launch.launchText ?? "No launch text available from feed."}</p>
        {launch.launchPostUrl && <a className="mt-2 inline-flex items-center gap-2 text-xs text-terminal-cyan" href={launch.launchPostUrl} target="_blank" rel="noreferrer">Open post <ExternalLink size={13} /></a>}
      </Section>
      <Section title="Offensive Signals">
        <Chips launch={launch} severity="alpha" fallback="No alpha labels detected yet." />
      </Section>
      <Section title="Defensive Warnings">
        <Chips launch={launch} severity="danger" fallback="No danger labels detected from public data." />
      </Section>
      <Section title="Related Launches">
        {related.length ? related.slice(0, 4).map((item, index) => <div key={`${item.tokenAddress}-${item.id}-${index}`} className="border-b border-terminal-border/70 py-2 text-xs"><span className="font-mono text-terminal-cyan">{item.tokenSymbol}</span> · {item.ageMinutes}m · OP {item.opportunityScore}</div>) : <div className="text-xs text-terminal-muted">No related launches from this creator in local 24h history.</div>}
      </Section>
      <div className="mt-4 grid gap-2">
        <a href={bankrUrl} className="border border-terminal-cyan/50 bg-terminal-cyan/10 px-3 py-2 text-center font-mono text-sm text-terminal-cyan">Open on Bankr</a>
        <Link href={`/analysis?address=${launch.tokenAddress}`} className="border border-terminal-green/50 bg-terminal-green/10 px-3 py-2 text-center font-mono text-sm text-terminal-green">Analyze Token</Link>
        <div className="grid grid-cols-2 gap-2">
          <a href={dexUrl} target="_blank" rel="noreferrer" className="border border-terminal-border px-3 py-2 text-center text-xs text-terminal-cyan">DexScreener</a>
          <a href={geckoUrl} target="_blank" rel="noreferrer" className="border border-terminal-border px-3 py-2 text-center text-xs text-terminal-cyan">GeckoTerminal</a>
        </div>
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="border border-terminal-border bg-[#0a0f16] p-2"><div className="text-[10px] uppercase tracking-[0.12em] text-terminal-muted">{label}</div><div className="mt-1 font-mono">{value}</div></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="mt-4 border-t border-terminal-border pt-4"><div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-terminal-muted">{title}</div>{children}</div>;
}

function Chips({ launch, severity, fallback }: { launch: BankrLaunch; severity: "alpha" | "danger"; fallback: string }) {
  const flags = launch.flags.filter((flag) => flag.severity === severity);
  if (!flags.length) return <div className="text-xs text-terminal-muted">{fallback}</div>;
  return <div className="flex flex-wrap gap-2">{flags.map((flag, index) => <span key={`${flag.type}-${flag.message}-${index}`} className={`border px-2 py-1 text-xs ${severity === "alpha" ? "border-terminal-green/40 text-terminal-green" : "border-terminal-red/40 text-terminal-red"}`}>{flag.message}</span>)}</div>;
}

function verdictTone(verdict: BankrLaunch["verdict"]) {
  if (verdict === "verified_alpha") return "border-terminal-green/40 text-terminal-green";
  if (verdict === "watch") return "border-terminal-cyan/40 text-terminal-cyan";
  if (verdict === "blocked") return "border-terminal-red/40 text-terminal-red";
  return "border-terminal-amber/40 text-terminal-amber";
}
