"use client";

import { CredibilityBadge } from "@/components/bankr/CredibilityBadge";
import { formatUsd } from "@/lib/utils";
import type { BankrLaunch } from "@/types/bankr";
import { ExternalLink } from "lucide-react";

type SortKey = "ageMinutes" | "credibilityScore" | "liquidityUsd" | "volume5m" | "volume1h" | "opportunityScore" | "riskScore";

export function BankrLaunchTable({ launches, selected, sortKey, onSort, onSelect }: { launches: BankrLaunch[]; selected?: BankrLaunch | null; sortKey: SortKey; onSort: (key: SortKey) => void; onSelect: (launch: BankrLaunch) => void }) {
  const header = (key: SortKey, label: string) => <button onClick={() => onSort(key)} className={sortKey === key ? "text-terminal-green" : "text-terminal-muted"}>{label}</button>;
  const bankrUrl = (launch: BankrLaunch) => `https://bankr.bot/launches/${launch.tokenAddress}`;
  return (
    <div className="min-h-0 overflow-auto border border-terminal-border bg-terminal-panel">
      <table className="w-full min-w-[1180px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-terminal-panel text-[10px] uppercase tracking-[0.14em]">
          <tr className="border-b border-terminal-border">
            <th className="px-3 py-3 text-left">{header("ageMinutes", "Age")}</th>
            <th className="px-3 py-3 text-left">Token</th>
            <th className="px-3 py-3 text-left">Symbol</th>
            <th className="px-3 py-3 text-left">Creator</th>
            <th className="px-3 py-3 text-left">Verdict</th>
            <th className="px-3 py-3 text-center">{header("credibilityScore", "Cred")}</th>
            <th className="px-3 py-3 text-right">{header("liquidityUsd", "Liq")}</th>
            <th className="px-3 py-3 text-right">{header("volume5m", "Vol 5m")}</th>
            <th className="px-3 py-3 text-right">{header("volume1h", "Vol 1h")}</th>
            <th className="px-3 py-3 text-right">Buy/Sell</th>
            <th className="px-3 py-3 text-right">FDV</th>
            <th className="px-3 py-3 text-center">{header("opportunityScore", "Opp")}</th>
            <th className="px-3 py-3 text-center">{header("riskScore", "Risk")}</th>
            <th className="px-3 py-3 text-left">Flags</th>
          </tr>
        </thead>
        <tbody>
          {launches.map((launch, index) => {
            const isSelected = selected?.tokenAddress.toLowerCase() === launch.tokenAddress.toLowerCase();
            return (
              <tr key={`${launch.tokenAddress}-${launch.id}-${index}`} onClick={() => onSelect(launch)} className={`cursor-pointer border-b border-terminal-border/70 hover:bg-terminal-green/5 ${isSelected ? "bg-terminal-green/10" : ""}`}>
                <td className="px-3 py-3 font-mono">{launch.ageMinutes < 30 && <span className="mr-2 animate-pulse border border-terminal-green/40 px-1 text-terminal-green">NEW</span>}{launch.ageMinutes}m</td>
                <td className="max-w-56 px-3 py-3 font-mono">
                  <a
                    href={bankrUrl(launch)}
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex max-w-full items-center gap-2 text-terminal-text underline-offset-4 hover:text-terminal-green hover:underline"
                    title={`Open ${launch.tokenName} on Bankr`}
                  >
                    <span className="truncate">{launch.tokenName}</span>
                    <ExternalLink size={13} className="shrink-0 text-terminal-muted" />
                  </a>
                </td>
                <td className="px-3 py-3 font-mono text-terminal-cyan">
                  <a href={bankrUrl(launch)} onClick={(event) => event.stopPropagation()} className="hover:text-terminal-green hover:underline" title={`Open ${launch.tokenSymbol} on Bankr`}>
                    {launch.tokenSymbol}
                  </a>
                </td>
                <td className="px-3 py-3">{launch.creatorHandle ? `@${launch.creatorHandle}` : "unknown"}</td>
                <td className="px-3 py-3">
                  <span className={`border px-2 py-1 font-mono text-[10px] uppercase ${verdictTone(launch.verdict)}`}>{launch.verdict.replace("_", " ")}</span>
                </td>
                <td className="px-3 py-3 text-center"><CredibilityBadge score={launch.credibilityScore} /></td>
                <td className="px-3 py-3 text-right font-mono">{formatUsd(launch.liquidityUsd, 1)}</td>
                <td className="px-3 py-3 text-right font-mono">{formatUsd(launch.volume5m, 1)}</td>
                <td className="px-3 py-3 text-right font-mono">{formatUsd(launch.volume1h, 1)}</td>
                <td className="px-3 py-3 text-right font-mono">{launch.buys5m ?? 0}/{launch.sells5m ?? 0}</td>
                <td className="px-3 py-3 text-right font-mono">{formatUsd(launch.fdv, 1)}</td>
                <td className="px-3 py-3 text-center"><CredibilityBadge score={launch.opportunityScore} label="OP" /></td>
                <td className="px-3 py-3 text-center"><CredibilityBadge score={launch.riskScore} label="RS" /></td>
                <td className="px-3 py-3">
                  <div className="flex max-w-72 flex-wrap gap-1">
                    {launch.flags.slice(0, 3).map((flag, flagIndex) => <span key={`${launch.id}-${flag.type}-${flag.message}-${flagIndex}`} className={`border px-2 py-1 text-[10px] ${flag.severity === "alpha" ? "border-terminal-green/40 text-terminal-green" : flag.severity === "danger" ? "border-terminal-red/40 text-terminal-red" : "border-terminal-amber/40 text-terminal-amber"}`}>{flag.message}</span>)}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!launches.length && <div className="p-8 text-center text-terminal-muted">No Bankr launches match the current filters.</div>}
    </div>
  );
}

export type { SortKey };

function verdictTone(verdict: BankrLaunch["verdict"]) {
  if (verdict === "verified_alpha") return "border-terminal-green/40 text-terminal-green";
  if (verdict === "watch") return "border-terminal-cyan/40 text-terminal-cyan";
  if (verdict === "blocked") return "border-terminal-red/40 text-terminal-red";
  return "border-terminal-amber/40 text-terminal-amber";
}
