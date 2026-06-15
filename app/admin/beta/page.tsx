import { getAlertPerformance } from "@/lib/trust/alertBacktest";
import { getBetaFeedbackSummary, getDataFreshnessSummary, getDataLayerHealth, getProviderReliabilitySummary, getSourceDisagreementSummary } from "@/lib/db/repository";
import { ensureFreshnessService } from "@/lib/indexer/freshnessService";
import Link from "next/link";

export const dynamic = "force-dynamic";

type CheckStatus = "ready" | "watch" | "blocker";

type BetaCheck = {
  label: string;
  status: CheckStatus;
  detail: string;
  owner: string;
};

export default async function PublicBetaPage() {
  const freshnessService = await ensureFreshnessService({ intervalMs: 30_000, marketLimit: 20 });
  if (freshnessService.running) await waitForFreshnessSettle();
  const dataLayer = safe(() => getDataLayerHealth(), null);
  const freshness = safe(() => getDataFreshnessSummary(), null);
  const disagreements = safe(() => getSourceDisagreementSummary(), null);
  const providers = safe(() => getProviderReliabilitySummary(100), []);
  const feedback = safe(() => getBetaFeedbackSummary(8), null);
  const alerts = safe(() => getAlertPerformance(), null);
  const checks = buildChecks({ dataLayer, freshness, disagreements, providers, feedback, alerts });
  const blockers = checks.filter((check) => check.status === "blocker");
  const watches = checks.filter((check) => check.status === "watch");
  const ready = checks.filter((check) => check.status === "ready");
  const verdict = blockers.length ? "Private beta only" : watches.length ? "Limited public beta candidate" : "Ready for limited public beta";
  const failedProviders = providers.filter((provider) => provider.latestStatus === "error" || provider.latestStatus === "missing");
  const limitedProviders = providers.filter((provider) => provider.latestStatus === "limited");
  const topDisagreements = disagreements?.issues.slice(0, 4) ?? [];

  return (
    <main className="min-h-screen bg-terminal-bg p-5 text-terminal-text">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-terminal-green">Launch Control</div>
            <h1 className="mt-2 font-mono text-3xl font-semibold">Public Beta Checklist</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-terminal-muted">
              A practical gate for deciding whether Momentum Terminal is ready to show real traders. This page should stay boring, strict, and evidence-driven.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/accuracy" className="rounded-lg border border-terminal-border bg-terminal-panel px-3 py-2 font-mono text-xs text-terminal-muted transition hover:border-terminal-amber hover:text-terminal-amber">Accuracy</Link>
            <Link href="/admin/feedback" className="rounded-lg border border-terminal-border bg-terminal-panel px-3 py-2 font-mono text-xs text-terminal-muted transition hover:border-terminal-cyan hover:text-terminal-cyan">Feedback</Link>
            <Link href="/" className="rounded-lg border border-terminal-border bg-terminal-panel px-3 py-2 font-mono text-xs text-terminal-muted transition hover:border-terminal-green hover:text-terminal-green">Terminal</Link>
          </div>
        </div>

        <section className="rounded-lg border border-terminal-border bg-terminal-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-terminal-muted">Verdict</div>
              <h2 className={`mt-2 text-2xl font-semibold ${blockers.length ? "text-terminal-red" : watches.length ? "text-terminal-amber" : "text-terminal-green"}`}>{verdict}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-terminal-muted">
                Public beta should only widen when blockers are zero and every watch item has a clear owner. Unknown accuracy is treated as risk, not as approval.
              </p>
            </div>
            <div className="grid min-w-[280px] grid-cols-3 gap-2 text-center font-mono text-xs">
              <Count label="ready" value={ready.length} status="ready" />
              <Count label="watch" value={watches.length} status="watch" />
              <Count label="blockers" value={blockers.length} status="blocker" />
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-3 md:grid-cols-4">
          <Stat label="Reports Open" value={feedback?.open ?? "N/A"} tone={feedback?.open ? "amber" : "green"} />
          <Stat label="Critical Feedback" value={feedback?.critical ?? "N/A"} tone={feedback?.critical ? "red" : "green"} />
          <Stat label="Provider Blockers" value={failedProviders.length} tone={failedProviders.length ? "red" : "green"} />
          <Stat label="Provider Limited" value={limitedProviders.length} tone={limitedProviders.length ? "amber" : "green"} />
          <Stat label="Freshness Heartbeat" value={freshnessService.enabled ? freshnessService.running ? "Refreshing" : "Running" : "Stopped"} tone={freshnessService.enabled ? "green" : "red"} />
          <Stat label="Stale Data Rate" value={freshness?.overallStaleRate === null || freshness?.overallStaleRate === undefined ? "N/A" : `${(freshness.overallStaleRate * 100).toFixed(1)}%`} tone={freshness?.overallStaleRate && freshness.overallStaleRate > 0.2 ? "amber" : "green"} />
          <Stat label="Source Disagreement" value={disagreements?.disagreementRate === null || disagreements?.disagreementRate === undefined ? "N/A" : `${(disagreements.disagreementRate * 100).toFixed(1)}%`} tone={disagreements?.disagreementRate && disagreements.disagreementRate > 0.15 ? "amber" : "green"} />
        </section>

        {(failedProviders.length || topDisagreements.length) ? (
          <section className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-terminal-border bg-terminal-panel p-4">
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-terminal-muted">Launch Blockers</div>
              <div className="mt-3 grid gap-2">
                {failedProviders.length ? failedProviders.map((provider) => (
                  <div key={provider.provider} className="rounded-lg border border-terminal-red/30 bg-terminal-red/10 p-3">
                    <div className="font-mono text-sm text-terminal-red">{provider.provider}: {provider.latestStatus}</div>
                    <div className="mt-1 text-xs text-terminal-muted">{provider.latestError ?? "No latest error recorded."}</div>
                    <div className="mt-1 text-[11px] text-terminal-muted">Last success: {provider.lastSuccessAt ?? "none recorded"}</div>
                  </div>
                )) : (
                  <div className="rounded-lg border border-terminal-green/30 bg-terminal-green/10 p-3 text-sm text-terminal-green">No provider launch blockers detected.</div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-terminal-border bg-terminal-panel p-4">
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-terminal-muted">Accuracy Blockers</div>
              <div className="mt-3 grid gap-2">
                {topDisagreements.length ? topDisagreements.map((issue) => (
                  <div key={`${issue.tokenAddress}-${issue.metric}`} className="rounded-lg border border-terminal-amber/30 bg-terminal-amber/10 p-3">
                    <div className="font-mono text-sm text-terminal-amber">{issue.symbol ?? "Token"} {issue.metric}: {issue.disagreementPct.toFixed(1)}%</div>
                    <div className="mt-2 grid gap-1 text-[11px] text-terminal-muted">
                      {issue.sources.map((source) => (
                        <div key={`${issue.tokenAddress}-${issue.metric}-${source.source}`} className="flex justify-between gap-3">
                          <span>{source.source}</span>
                          <span className="font-mono text-terminal-text">{formatNumber(source.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )) : (
                  <div className="rounded-lg border border-terminal-green/30 bg-terminal-green/10 p-3 text-sm text-terminal-green">No active source-disagreement blockers detected.</div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-5 rounded-lg border border-terminal-border bg-terminal-panel">
          <div className="border-b border-terminal-border p-3">
            <div className="font-mono text-xs uppercase tracking-[0.14em] text-terminal-muted">Gate Checks</div>
            <p className="mt-1 text-xs text-terminal-muted">Each row has a suggested owner so the beta plan stays actionable.</p>
          </div>
          <div className="grid gap-3 p-3 lg:grid-cols-2">
            {checks.map((check) => (
              <div key={check.label} className="rounded-lg border border-terminal-border bg-terminal-bg/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-mono text-sm text-terminal-text">{check.label}</div>
                  <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${statusClass(check.status)}`}>{check.status}</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-terminal-muted">{check.detail}</p>
                <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-terminal-muted">Owner: {check.owner}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-lg border border-terminal-amber/35 bg-terminal-amber/10 p-4 text-sm text-terminal-amber">
          <div className="font-mono text-xs uppercase tracking-[0.14em]">Beta rule</div>
          <p className="mt-2 leading-relaxed text-terminal-muted">
            If a user reports a wrong market cap, holder count, buy/sell window, or risk label, treat it as a product reliability incident until reconciled. Public trust is the product.
          </p>
        </section>
      </div>
    </main>
  );
}

function buildChecks({
  dataLayer,
  freshness,
  disagreements,
  providers,
  feedback,
  alerts
}: {
  dataLayer: ReturnType<typeof getDataLayerHealth> | null;
  freshness: ReturnType<typeof getDataFreshnessSummary> | null;
  disagreements: ReturnType<typeof getSourceDisagreementSummary> | null;
  providers: ReturnType<typeof getProviderReliabilitySummary>;
  feedback: ReturnType<typeof getBetaFeedbackSummary> | null;
  alerts: ReturnType<typeof getAlertPerformance> | null;
}): BetaCheck[] {
  const staleRate = freshness?.overallStaleRate ?? null;
  const disagreementRate = disagreements?.disagreementRate ?? null;
  const feedbackBlockers = (feedback?.critical ?? 0) + (feedback?.high ?? 0);
  const failedProviders = providers.filter((provider) => provider.latestStatus === "error" || provider.latestStatus === "missing");
  const limitedProviders = providers.filter((provider) => provider.latestStatus === "limited");
  const coreProviderBlockers = failedProviders.filter((provider) => isCoreProvider(provider.provider));
  const coreProviderLimited = limitedProviders.filter((provider) => isCoreProvider(provider.provider));
  return [
    {
      label: "User-facing limitations",
      status: "ready",
      detail: "The terminal includes visible beta warnings, limitations, and issue reporting links.",
      owner: "Product"
    },
    {
      label: "Data persistence",
      status: dataLayer && dataLayer.tables.marketSnapshots > 0 && dataLayer.tables.trustedMetrics > 0 ? "ready" : "blocker",
      detail: dataLayer ? `${dataLayer.tables.marketSnapshots} market snapshots and ${dataLayer.tables.trustedMetrics} trusted metrics are stored locally.` : "Data layer unavailable.",
      owner: "Data"
    },
    {
      label: "Freshness control",
      status: staleRate === null ? "watch" : staleRate > 0.35 ? "blocker" : staleRate > 0.15 ? "watch" : "ready",
      detail: staleRate === null ? "No freshness evidence available yet." : `${(staleRate * 100).toFixed(1)}% stale observation rate across tracked buckets.`,
      owner: "Data"
    },
    {
      label: "Provider reliability",
      status: coreProviderBlockers.length ? "blocker" : coreProviderLimited.length || providers.length < 5 ? "watch" : "ready",
      detail: coreProviderBlockers.length
        ? `${coreProviderBlockers.length} core provider blocker${coreProviderBlockers.length === 1 ? "" : "s"}: ${coreProviderBlockers.map((provider) => provider.provider).join(", ")}.`
        : coreProviderLimited.length
          ? `${coreProviderLimited.length} core provider${coreProviderLimited.length === 1 ? " is" : "s are"} rate-limited: ${coreProviderLimited.map((provider) => provider.provider).join(", ")}.`
          : limitedProviders.length
            ? `Core providers are usable. Optional enrichment limited: ${limitedProviders.map((provider) => provider.provider).join(", ")}.`
            : `${providers.length} providers have reliability observations and no latest blocker state.`,
      owner: "Infrastructure"
    },
    {
      label: "Source reconciliation",
      status: disagreementRate !== null && disagreementRate > 0.25 ? "blocker" : disagreementRate !== null && disagreementRate > 0.1 ? "watch" : "ready",
      detail: disagreementRate === null ? "No active same-pair source comparisons are available; missing overlap is visible in the accuracy dashboard." : `${(disagreementRate * 100).toFixed(1)}% disagreement rate across comparable tokens.`,
      owner: "Data"
    },
    {
      label: "Holder/indexer coverage",
      status: dataLayer && dataLayer.tables.holderSnapshots > 0 && dataLayer.tables.walletObservations > 0 ? "ready" : dataLayer?.tables.holderSnapshots ? "watch" : "blocker",
      detail: dataLayer ? `${dataLayer.tables.holderSnapshots} holder snapshots and ${dataLayer.tables.walletObservations} wallet observations are stored.` : "Holder evidence unavailable.",
      owner: "Indexer"
    },
    {
      label: "Feedback triage",
      status: feedbackBlockers > 0 ? "blocker" : (feedback?.open ?? 0) > 10 ? "watch" : "ready",
      detail: feedback ? `${feedback.open} open reports, ${feedback.critical} critical, ${feedback.high} high, ${feedback.dataAccuracy} data-accuracy related.` : "Feedback queue unavailable.",
      owner: "Support"
    },
    {
      label: "Alert accountability",
      status: (alerts?.totalAlertsTracked ?? 0) > 25 && (alerts?.knownOutcomes ?? 0) > 0 ? "ready" : (alerts?.totalAlertsTracked ?? 0) > 0 ? "watch" : "blocker",
      detail: alerts ? `${alerts.totalAlertsTracked} alerts tracked, ${alerts.knownOutcomes ?? 0} with matured outcomes. Outcome coverage must improve before aggressive alert language.` : "Alert backtesting unavailable.",
      owner: "Signals"
    },
    {
      label: "Recovery UX",
      status: "ready",
      detail: "Main routes have controlled error boundaries and branded loading states.",
      owner: "Frontend"
    }
  ];
}

function isCoreProvider(provider: string) {
  return [
    "Base RPC",
    "Alchemy Base RPC",
    "Etherscan/BaseScan",
    "Blockscout Base",
    "DexScreener",
    "GeckoTerminal",
    "Bankr"
  ].includes(provider);
}

function waitForFreshnessSettle() {
  return new Promise((resolve) => setTimeout(resolve, 900));
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function Count({ label, value, status }: { label: string; value: number; status: CheckStatus }) {
  return (
    <div className={`rounded-lg border p-2 ${statusClass(status)}`}>
      <div className="text-lg font-semibold">{value}</div>
      {label}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone: "green" | "amber" | "red" | "cyan" }) {
  const colors = {
    green: "text-terminal-green",
    amber: "text-terminal-amber",
    red: "text-terminal-red",
    cyan: "text-terminal-cyan"
  };
  return (
    <div className="rounded-lg border border-terminal-border bg-terminal-panel p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-terminal-muted">{label}</div>
      <div className={`mt-2 font-mono text-lg ${colors[tone]}`}>{value}</div>
    </div>
  );
}

function statusClass(status: CheckStatus) {
  if (status === "ready") return "border-terminal-green/40 bg-terminal-green/10 text-terminal-green";
  if (status === "watch") return "border-terminal-amber/40 bg-terminal-amber/10 text-terminal-amber";
  return "border-terminal-red/40 bg-terminal-red/10 text-terminal-red";
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "N/A";
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (Math.abs(value) >= 1) return `$${value.toFixed(2)}`;
  return value.toPrecision(4);
}
