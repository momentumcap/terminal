import { getDataFreshnessSummary, getDataLayerHealth, getProviderReliabilitySummary, getSourceDisagreementSummary, type DataFreshnessSummary, type ProviderReliabilitySummary, type SourceDisagreementSummary } from "@/lib/db/repository";
import { getCacheTelemetrySummary, type CacheTelemetrySummary } from "@/lib/cacheTelemetry";
import { getAlertPerformance } from "@/lib/trust/alertBacktest";
import { IndexerControl } from "@/components/admin/IndexerControl";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AccuracyPage() {
  const dataLayer = safeDataLayerHealth();
  const providerReliability = safeProviderReliability();
  const health = buildProviderHealthFromReliability(providerReliability);
  const freshness = safeDataFreshness();
  const disagreements = safeSourceDisagreements();
  const cacheTelemetry = safeCacheTelemetry();
  const alertPerformance = safeAlertPerformance();
  const readinessChecks = getPublicBetaReadiness({
    providerSummary: health.summary,
    dataLayer,
    freshness,
    disagreements,
    alertPerformance
  });
  const blockerCount = readinessChecks.filter((check) => check.status === "blocker").length;
  const watchCount = readinessChecks.filter((check) => check.status === "watch").length;
  const readyCount = readinessChecks.filter((check) => check.status === "ready").length;
  const readinessStatus = blockerCount > 0 ? "Not ready" : watchCount > 0 ? "Beta candidate" : "Ready for limited beta";
  return (
    <main className="min-h-screen bg-terminal-bg p-5 text-terminal-text">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-semibold">Trust & Accuracy Dashboard</h1>
          <p className="mt-1 text-sm text-terminal-muted">When we know, we show evidence. When we do not know, we say so.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/beta" className="border border-terminal-green/40 bg-terminal-green/10 px-3 py-2 font-mono text-xs text-terminal-green transition hover:border-terminal-green hover:text-terminal-text">
            Beta Checklist
          </Link>
          <Link href="/admin/feedback" className="border border-terminal-amber/40 bg-terminal-amber/10 px-3 py-2 font-mono text-xs text-terminal-amber transition hover:border-terminal-amber hover:text-terminal-text">
            Feedback Triage
          </Link>
          <div className="border border-terminal-border bg-terminal-panel px-3 py-2 font-mono text-xs text-terminal-muted">Updated {health.servedAt}</div>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="Providers OK" value={health.summary.ok} tone="green" />
        <Stat label="Providers Missing" value={health.summary.missing} tone="amber" />
        <Stat label="Provider Errors" value={health.summary.error} tone="red" />
        <Stat label="Avg Latency" value={health.summary.averageLatencyMs === null ? "N/A" : `${health.summary.averageLatencyMs}ms`} tone="cyan" />
      </section>

      <section className="mt-5 border border-terminal-border bg-terminal-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.14em] text-terminal-muted">Public Beta Readiness</div>
            <h2 className="mt-2 text-xl font-semibold text-terminal-text">{readinessStatus}</h2>
            <p className="mt-1 max-w-3xl text-sm text-terminal-muted">
              This is a launch gate, not a marketing score. A blocker means the terminal should stay private until the evidence improves.
            </p>
          </div>
          <div className="grid min-w-[260px] grid-cols-3 gap-2 text-center font-mono text-xs">
            <div className="border border-terminal-green/30 bg-terminal-green/10 p-2 text-terminal-green">
              <div className="text-lg font-semibold">{readyCount}</div>
              ready
            </div>
            <div className="border border-terminal-amber/30 bg-terminal-amber/10 p-2 text-terminal-amber">
              <div className="text-lg font-semibold">{watchCount}</div>
              watch
            </div>
            <div className="border border-terminal-red/30 bg-terminal-red/10 p-2 text-terminal-red">
              <div className="text-lg font-semibold">{blockerCount}</div>
              blockers
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {readinessChecks.map((check) => (
            <div key={check.label} className="border border-terminal-border bg-terminal-bg/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-sm text-terminal-text">{check.label}</div>
                <div className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${readinessToneClass(check.status)}`}>
                  {check.status}
                </div>
              </div>
              <p className="mt-2 text-sm text-terminal-muted">{check.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 border border-terminal-border bg-terminal-panel">
        <div className="border-b border-terminal-border p-3 font-mono text-xs uppercase tracking-[0.14em] text-terminal-muted">Provider Health</div>
        <div className="overflow-auto">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead className="text-[10px] uppercase tracking-[0.14em] text-terminal-muted">
              <tr className="border-b border-terminal-border">
                <th className="px-3 py-2 text-left">Provider</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-right">Latency</th>
                <th className="px-3 py-2 text-right">Latest Block</th>
                <th className="px-3 py-2 text-left">Last Success</th>
                <th className="px-3 py-2 text-left">Last Error</th>
              </tr>
            </thead>
            <tbody>
              {health.providers.map((provider) => (
                <tr key={provider.provider} className="border-b border-terminal-border/60">
                  <td className="px-3 py-2 font-mono">{provider.provider}</td>
                  <td className={`px-3 py-2 font-mono ${provider.latestStatus === "ok" ? "text-terminal-green" : provider.latestStatus === "missing" || provider.latestStatus === "limited" ? "text-terminal-amber" : "text-terminal-red"}`}>{provider.latestStatus}</td>
                  <td className="px-3 py-2 text-right font-mono">{provider.averageLatencyMs === null ? "N/A" : `${provider.averageLatencyMs}ms`}</td>
                  <td className="px-3 py-2 text-right font-mono">{provider.latestBlock ?? "N/A"}</td>
                  <td className="px-3 py-2 font-mono text-terminal-muted">{provider.lastSuccessAt ?? "N/A"}</td>
                  <td className="px-3 py-2 text-terminal-muted">{provider.latestError ?? "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-5 border border-terminal-border bg-terminal-panel">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-terminal-border p-3">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.14em] text-terminal-muted">Provider Reliability History</div>
            <p className="mt-1 text-xs text-terminal-muted">Based on the last 100 persisted checks per provider. Missing providers reduce reliability instead of being hidden.</p>
          </div>
          <div className="font-mono text-[11px] text-terminal-muted">{providerReliability.length} providers tracked</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="text-[10px] uppercase tracking-[0.14em] text-terminal-muted">
              <tr className="border-b border-terminal-border">
                <th className="px-3 py-2 text-left">Provider</th>
                <th className="px-3 py-2 text-left">Latest</th>
                <th className="px-3 py-2 text-right">Reliability</th>
                <th className="px-3 py-2 text-right">Checks</th>
                <th className="px-3 py-2 text-right">Errors</th>
                <th className="px-3 py-2 text-right">Missing</th>
                <th className="px-3 py-2 text-right">Avg Latency</th>
                <th className="px-3 py-2 text-left">Last Success</th>
                <th className="px-3 py-2 text-left">Latest Error</th>
              </tr>
            </thead>
            <tbody>
              {providerReliability.length ? providerReliability.map((provider) => (
                <tr key={provider.provider} className="border-b border-terminal-border/60">
                  <td className="px-3 py-2 font-mono">{provider.provider}</td>
                  <td className={`px-3 py-2 font-mono ${provider.latestStatus === "ok" ? "text-terminal-green" : provider.latestStatus === "missing" || provider.latestStatus === "limited" ? "text-terminal-amber" : "text-terminal-red"}`}>{provider.latestStatus}</td>
                  <td className="px-3 py-2 text-right font-mono">{provider.uptimePct === null ? "N/A" : `${(provider.uptimePct * 100).toFixed(1)}%`}</td>
                  <td className="px-3 py-2 text-right font-mono">{provider.totalChecks}</td>
                  <td className="px-3 py-2 text-right font-mono text-terminal-red">{provider.errorChecks}</td>
                  <td className="px-3 py-2 text-right font-mono text-terminal-amber">{provider.missingChecks}</td>
                  <td className="px-3 py-2 text-right font-mono">{provider.averageLatencyMs === null ? "N/A" : `${provider.averageLatencyMs}ms`}</td>
                  <td className="px-3 py-2 font-mono text-terminal-muted">{provider.lastSuccessAt ?? "N/A"}</td>
                  <td className="max-w-[260px] truncate px-3 py-2 text-terminal-muted">{provider.latestError ?? "N/A"}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={9} className="px-3 py-4 text-center text-sm text-terminal-muted">No provider reliability history yet. Run provider health checks to start collecting evidence.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-3">
        <Stat label="Stale Data Rate" value={freshness.overallStaleRate === null ? "No data" : `${(freshness.overallStaleRate * 100).toFixed(1)}%`} tone={freshness.overallStaleRate !== null && freshness.overallStaleRate > 0.35 ? "red" : freshness.overallStaleRate ? "amber" : "green"} />
        <Stat label="Source Disagreement Rate" value={disagreements.disagreementRate === null ? "No comparisons" : `${(disagreements.disagreementRate * 100).toFixed(1)}%`} tone={disagreements.disagreementRate !== null && disagreements.disagreementRate > 0.25 ? "red" : disagreements.disagreementRate ? "amber" : "green"} />
        <Stat label="Cache Hit Rate" value={cacheTelemetry.hitRate === null ? "No lookups" : `${(cacheTelemetry.hitRate * 100).toFixed(1)}%`} tone={cacheTelemetry.hitRate === null ? "amber" : cacheTelemetry.hitRate >= 0.5 ? "green" : "amber"} />
      </section>

      <section className="mt-5 border border-terminal-border bg-terminal-panel">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-terminal-border p-3">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.14em] text-terminal-muted">Data Freshness</div>
            <p className="mt-1 text-xs text-terminal-muted">Freshness is measured from persisted observations. Stale data cannot produce high-confidence claims.</p>
          </div>
          <div className="font-mono text-[11px] text-terminal-muted">{freshness.staleEntities}/{freshness.totalEntities} stale · {freshness.fetchedAt}</div>
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead className="text-[10px] uppercase tracking-[0.14em] text-terminal-muted">
              <tr className="border-b border-terminal-border">
                <th className="px-3 py-2 text-left">Bucket</th>
                <th className="px-3 py-2 text-right">Stale Rate</th>
                <th className="px-3 py-2 text-right">Fresh</th>
                <th className="px-3 py-2 text-right">Stale</th>
                <th className="px-3 py-2 text-right">Threshold</th>
                <th className="px-3 py-2 text-left">Latest Observation</th>
                <th className="px-3 py-2 text-left">Warning</th>
              </tr>
            </thead>
            <tbody>
              {freshness.buckets.map((bucket) => (
                <tr key={bucket.table} className="border-b border-terminal-border/60">
                  <td className="px-3 py-2 font-mono">{bucket.label}</td>
                  <td className={`px-3 py-2 text-right font-mono ${bucket.staleRate === null ? "text-terminal-muted" : bucket.staleRate > 0.5 ? "text-terminal-red" : bucket.staleRate > 0 ? "text-terminal-amber" : "text-terminal-green"}`}>{bucket.staleRate === null ? "N/A" : `${(bucket.staleRate * 100).toFixed(1)}%`}</td>
                  <td className="px-3 py-2 text-right font-mono text-terminal-green">{bucket.freshEntities}</td>
                  <td className="px-3 py-2 text-right font-mono text-terminal-amber">{bucket.staleEntities}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatThreshold(bucket.thresholdMs)}</td>
                  <td className="px-3 py-2 font-mono text-terminal-muted">{bucket.latestObservedAt ?? "None"}</td>
                  <td className="px-3 py-2 text-terminal-muted">{bucket.warning ?? "Fresh"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-5 border border-terminal-border bg-terminal-panel">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-terminal-border p-3">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.14em] text-terminal-muted">Source Disagreements</div>
            <p className="mt-1 text-xs text-terminal-muted">Flags material differences between persisted provider snapshots. No comparison means only one usable source was available.</p>
          </div>
          <div className="font-mono text-[11px] text-terminal-muted">{disagreements.tokensWithDisagreement}/{disagreements.comparableTokens} comparable tokens flagged · {disagreements.fetchedAt}</div>
        </div>
        <div className="grid gap-3 border-b border-terminal-border p-3 md:grid-cols-4">
          <Stat label="Price Issues" value={disagreements.metricCounts.price} tone={disagreements.metricCounts.price ? "amber" : "green"} />
          <Stat label="Liquidity Issues" value={disagreements.metricCounts.liquidity} tone={disagreements.metricCounts.liquidity ? "amber" : "green"} />
          <Stat label="Market Cap Issues" value={disagreements.metricCounts.marketCap} tone={disagreements.metricCounts.marketCap ? "amber" : "green"} />
          <Stat label="Volume Issues" value={disagreements.metricCounts.volume24h} tone={disagreements.metricCounts.volume24h ? "amber" : "green"} />
        </div>
        <div className="overflow-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="text-[10px] uppercase tracking-[0.14em] text-terminal-muted">
              <tr className="border-b border-terminal-border">
                <th className="px-3 py-2 text-left">Token</th>
                <th className="px-3 py-2 text-left">Metric</th>
                <th className="px-3 py-2 text-right">Difference</th>
                <th className="px-3 py-2 text-right">Threshold</th>
                <th className="px-3 py-2 text-left">Source Values</th>
              </tr>
            </thead>
            <tbody>
              {disagreements.issues.length ? disagreements.issues.map((issue) => (
                <tr key={`${issue.tokenAddress}-${issue.metric}`} className="border-b border-terminal-border/60">
                  <td className="px-3 py-2">
                    <div className="font-mono text-terminal-text">{issue.symbol ?? "UNKNOWN"}</div>
                    <div className="font-mono text-[11px] text-terminal-muted">{issue.tokenAddress.slice(0, 10)}...{issue.tokenAddress.slice(-6)}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-terminal-muted">{issue.metric}</td>
                  <td className="px-3 py-2 text-right font-mono text-terminal-amber">{issue.disagreementPct.toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right font-mono">{issue.thresholdPct.toFixed(0)}%</td>
                  <td className="px-3 py-2 font-mono text-xs text-terminal-muted">{issue.sources.map((source) => `${source.source}: ${formatNumber(source.value)}`).join(" · ")}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-sm text-terminal-muted">No material source disagreements detected from comparable persisted snapshots.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-5 border border-terminal-border bg-terminal-panel">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-terminal-border p-3">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.14em] text-terminal-muted">Cache Telemetry</div>
            <p className="mt-1 text-xs text-terminal-muted">In-memory cache telemetry for rate-limit protection. Restarts reset these counters.</p>
          </div>
          <div className="font-mono text-[11px] text-terminal-muted">{cacheTelemetry.totalEvents} events · {cacheTelemetry.fetchedAt}</div>
        </div>
        <div className="grid gap-3 border-b border-terminal-border p-3 md:grid-cols-5">
          <Stat label="Hits" value={cacheTelemetry.hits} tone="green" />
          <Stat label="Misses" value={cacheTelemetry.misses} tone="amber" />
          <Stat label="Expired" value={cacheTelemetry.expired} tone="amber" />
          <Stat label="Sets" value={cacheTelemetry.sets} tone="cyan" />
          <Stat label="Namespaces" value={cacheTelemetry.byNamespace.length} tone="cyan" />
        </div>
        <div className="grid gap-4 p-3 lg:grid-cols-[1fr_1.3fr]">
          <div className="overflow-auto border border-terminal-border bg-terminal-bg/40">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead className="text-[10px] uppercase tracking-[0.14em] text-terminal-muted">
                <tr className="border-b border-terminal-border">
                  <th className="px-3 py-2 text-left">Namespace</th>
                  <th className="px-3 py-2 text-right">Hit Rate</th>
                  <th className="px-3 py-2 text-right">Hits</th>
                  <th className="px-3 py-2 text-right">Misses</th>
                  <th className="px-3 py-2 text-left">Last Event</th>
                </tr>
              </thead>
              <tbody>
                {cacheTelemetry.byNamespace.length ? cacheTelemetry.byNamespace.map((namespace) => (
                  <tr key={namespace.namespace} className="border-b border-terminal-border/60">
                    <td className="px-3 py-2 font-mono">{namespace.namespace}</td>
                    <td className="px-3 py-2 text-right font-mono">{namespace.hitRate === null ? "N/A" : `${(namespace.hitRate * 100).toFixed(1)}%`}</td>
                    <td className="px-3 py-2 text-right font-mono text-terminal-green">{namespace.hits}</td>
                    <td className="px-3 py-2 text-right font-mono text-terminal-amber">{namespace.misses}</td>
                    <td className="px-3 py-2 font-mono text-terminal-muted">{namespace.lastEventAt ?? "N/A"}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-sm text-terminal-muted">No cache lookups observed yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="overflow-auto border border-terminal-border bg-terminal-bg/40">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead className="text-[10px] uppercase tracking-[0.14em] text-terminal-muted">
                <tr className="border-b border-terminal-border">
                  <th className="px-3 py-2 text-left">Event</th>
                  <th className="px-3 py-2 text-left">Namespace</th>
                  <th className="px-3 py-2 text-left">Key</th>
                  <th className="px-3 py-2 text-left">Observed</th>
                </tr>
              </thead>
              <tbody>
                {cacheTelemetry.recentEvents.length ? cacheTelemetry.recentEvents.slice(0, 10).map((event, index) => (
                  <tr key={`${event.observedAt}-${event.namespace}-${event.type}-${index}`} className="border-b border-terminal-border/60">
                    <td className={event.type === "hit" ? "px-3 py-2 font-mono text-terminal-green" : event.type === "set" ? "px-3 py-2 font-mono text-terminal-cyan" : "px-3 py-2 font-mono text-terminal-amber"}>{event.type}</td>
                    <td className="px-3 py-2 font-mono text-terminal-muted">{event.namespace}</td>
                    <td className="max-w-[260px] truncate px-3 py-2 font-mono text-xs text-terminal-muted">{event.key}</td>
                    <td className="px-3 py-2 font-mono text-terminal-muted">{event.observedAt}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-sm text-terminal-muted">No recent cache events yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mt-5 border border-terminal-border bg-terminal-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-mono text-xs uppercase tracking-[0.14em] text-terminal-muted">Data Layer</div>
          <div className="font-mono text-[11px] text-terminal-muted">{dataLayer.mode} · {dataLayer.path}</div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Stat label="Tokens" value={dataLayer.tables.tokens} tone="cyan" />
          <Stat label="Market Snapshots" value={dataLayer.tables.marketSnapshots} tone="green" />
          <Stat label="Trusted Metrics" value={dataLayer.tables.trustedMetrics} tone="cyan" />
          <Stat label="Analysis Snapshots" value={dataLayer.tables.analysisSnapshots} tone="green" />
          <Stat label="Holder Snapshots" value={dataLayer.tables.holderSnapshots} tone="amber" />
          <Stat label="Transfer Logs" value={dataLayer.tables.transferObservations} tone="cyan" />
          <Stat label="Wallet Memory" value={dataLayer.tables.walletObservations} tone="green" />
          <Stat label="Indexer Runs" value={dataLayer.tables.indexerRuns} tone="amber" />
          <Stat label="Tracked Tokens" value={dataLayer.tables.trackedIndexerTokens} tone="cyan" />
          <Stat label="Wallet Events" value={dataLayer.tables.walletIntelligenceEvents} tone="green" />
          <Stat label="Event Performance" value={dataLayer.tables.walletEventPerformance} tone="cyan" />
          <Stat label="Bankr Launches" value={dataLayer.tables.bankrLaunches} tone="cyan" />
          <Stat label="Provider Checks" value={dataLayer.tables.providerObservations} tone="green" />
          <Stat label="Cache Events" value={dataLayer.tables.cacheTelemetryEvents} tone="cyan" />
          <Stat label="Beta Feedback" value={dataLayer.tables.betaFeedbackReports} tone={dataLayer.tables.betaFeedbackReports ? "amber" : "green"} />
          <Stat label="Latest Market Write" value={dataLayer.latest.market ?? "None yet"} tone="cyan" />
          <Stat label="Latest Indexer Run" value={dataLayer.latest.indexer ?? "None yet"} tone="cyan" />
          <Stat label="Latest Feedback" value={dataLayer.latest.betaFeedback ?? "None yet"} tone="amber" />
        </div>
      </section>

      <IndexerControl />

      <section className="mt-5 border border-terminal-border bg-terminal-panel p-4">
        <div className="font-mono text-xs uppercase tracking-[0.14em] text-terminal-muted">Alert Backtesting</div>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Stat label="Alerts Tracked" value={alertPerformance.totalAlertsTracked ?? 0} tone="cyan" />
          <Stat label="False Positive Rate" value={alertPerformance.falsePositiveRate === null ? "Unknown" : `${(alertPerformance.falsePositiveRate * 100).toFixed(1)}%`} tone="amber" />
          <Stat label="Avg Return After Alert" value={alertPerformance.averageReturnAfterAlert === null ? "Unknown" : `${(alertPerformance.averageReturnAfterAlert * 100).toFixed(2)}%`} tone="green" />
          <Stat label="Outcome Coverage" value={alertPerformance.outcomeCoverage === null || alertPerformance.outcomeCoverage === undefined ? "No outcomes yet" : `${(alertPerformance.outcomeCoverage * 100).toFixed(1)}%`} tone={alertPerformance.outcomeCoverage ? "green" : "amber"} />
        </div>
      </section>
    </main>
  );
}

function safeProviderReliability(): ProviderReliabilitySummary[] {
  try {
    return getProviderReliabilitySummary(100);
  } catch {
    return [];
  }
}

function buildProviderHealthFromReliability(providers: ProviderReliabilitySummary[]) {
  const ok = providers.filter((provider) => provider.latestStatus === "ok").length;
  const missing = providers.filter((provider) => provider.latestStatus === "missing").length;
  const limited = providers.filter((provider) => provider.latestStatus === "limited").length;
  const error = providers.filter((provider) => provider.latestStatus === "error").length;
  const latencyValues = providers
    .map((provider) => provider.averageLatencyMs)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return {
    providers,
    summary: {
      ok,
      missing,
      limited,
      error,
      averageLatencyMs: latencyValues.length ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length) : null
    },
    servedAt: new Date().toISOString()
  };
}

function safeAlertPerformance() {
  try {
    return getAlertPerformance();
  } catch {
    return {
      totalAlertsTracked: 0,
      knownOutcomes: 0,
      unknownOutcomes: 0,
      outcomeCoverage: null,
      precisionByAlertType: [],
      falsePositiveRate: null,
      averageReturnAfterAlert: null,
      bestAlertCategories: [],
      worstAlertCategories: []
    };
  }
}

function safeDataFreshness(): DataFreshnessSummary {
  try {
    return getDataFreshnessSummary();
  } catch {
    return {
      overallStaleRate: null,
      totalEntities: 0,
      staleEntities: 0,
      buckets: [],
      fetchedAt: new Date().toISOString()
    };
  }
}

function safeSourceDisagreements(): SourceDisagreementSummary {
  try {
    return getSourceDisagreementSummary();
  } catch {
    return {
      comparableTokens: 0,
      tokensWithDisagreement: 0,
      disagreementRate: null,
      metricCounts: { price: 0, liquidity: 0, marketCap: 0, volume24h: 0 },
      issues: [],
      fetchedAt: new Date().toISOString()
    };
  }
}

function safeCacheTelemetry(): CacheTelemetrySummary {
  try {
    return getCacheTelemetrySummary();
  } catch {
    return {
      totalEvents: 0,
      hits: 0,
      misses: 0,
      expired: 0,
      sets: 0,
      hitRate: null,
      byNamespace: [],
      recentEvents: [],
      fetchedAt: new Date().toISOString()
    };
  }
}

function safeDataLayerHealth() {
  try {
    return getDataLayerHealth();
  } catch {
    return {
      mode: "sqlite",
      path: "unavailable",
      tables: {
        tokens: 0,
        marketSnapshots: 0,
        trustedMetrics: 0,
        analysisSnapshots: 0,
        holderSnapshots: 0,
        transferObservations: 0,
        walletObservations: 0,
        indexerRuns: 0,
        trackedIndexerTokens: 0,
        walletIntelligenceEvents: 0,
        walletEventPerformance: 0,
        alertBacktestRecords: 0,
        bankrLaunches: 0,
        providerObservations: 0,
        cacheTelemetryEvents: 0,
        betaFeedbackReports: 0
      },
      latest: {
        market: null,
        analysis: null,
        holders: null,
        transfers: null,
        indexer: null,
        walletEvents: null,
        walletPerformance: null,
        alertBacktests: null,
        bankr: null,
        providers: null,
        cacheTelemetry: null,
        betaFeedback: null
      }
    };
  }
}

function formatThreshold(ms: number) {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 60 * 60_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.round(ms / 60 / 60_000)}h`;
}

function formatNumber(value: number) {
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  if (Math.abs(value) >= 1) return `$${value.toFixed(4)}`;
  return `$${value.toPrecision(4)}`;
}

type ReadinessStatus = "ready" | "watch" | "blocker";

type ReadinessCheck = {
  label: string;
  status: ReadinessStatus;
  detail: string;
};

function getPublicBetaReadiness({
  providerSummary,
  dataLayer,
  freshness,
  disagreements,
  alertPerformance
}: {
  providerSummary: { ok: number; missing: number; error: number; averageLatencyMs: number | null };
  dataLayer: ReturnType<typeof safeDataLayerHealth>;
  freshness: DataFreshnessSummary;
  disagreements: SourceDisagreementSummary;
  alertPerformance: any;
}): ReadinessCheck[] {
  const hasMarketData = dataLayer.tables.marketSnapshots > 0;
  const hasTrustedMetrics = dataLayer.tables.trustedMetrics > 0;
  const hasProviderEvidence = dataLayer.tables.providerObservations > 0;
  const staleRate = freshness.overallStaleRate;
  const disagreementRate = disagreements.disagreementRate;
  return [
    {
      label: "Live providers",
      status: providerSummary.error > 0 ? "blocker" : providerSummary.ok >= 3 ? "ready" : "watch",
      detail: `${providerSummary.ok} providers are OK, ${providerSummary.missing} are missing, ${providerSummary.error} are failing. Public beta needs at least market, RPC, and one indexer path healthy.`
    },
    {
      label: "Freshness protection",
      status: staleRate === null ? "watch" : staleRate > 0.5 ? "blocker" : staleRate > 0.2 ? "watch" : "ready",
      detail: staleRate === null ? "No persisted freshness sample yet. Run the terminal and indexer long enough to collect evidence." : `${(staleRate * 100).toFixed(1)}% of persisted observations are stale. Stale data is blocked from high-confidence labels.`
    },
    {
      label: "Source reconciliation",
      status: disagreementRate === null ? "watch" : disagreementRate > 0.35 ? "blocker" : disagreementRate > 0.15 ? "watch" : "ready",
      detail: disagreementRate === null ? "No comparable multi-source snapshots yet. More provider overlap is needed before this can pass." : `${(disagreementRate * 100).toFixed(1)}% of comparable tokens have material source disagreement.`
    },
    {
      label: "Persistence layer",
      status: hasMarketData && hasTrustedMetrics && hasProviderEvidence ? "ready" : hasMarketData ? "watch" : "blocker",
      detail: `${dataLayer.tables.marketSnapshots} market snapshots, ${dataLayer.tables.trustedMetrics} trusted metrics, and ${dataLayer.tables.providerObservations} provider checks are stored.`
    },
    {
      label: "Holder and wallet evidence",
      status: dataLayer.tables.holderSnapshots > 0 && dataLayer.tables.walletObservations > 0 ? "ready" : dataLayer.tables.holderSnapshots > 0 ? "watch" : "blocker",
      detail: `${dataLayer.tables.holderSnapshots} holder snapshots and ${dataLayer.tables.walletObservations} wallet observations are stored. Holder claims should remain qualified until indexer coverage is broad.`
    },
    {
      label: "Alert accountability",
      status: (alertPerformance.totalAlertsTracked ?? 0) > 25 && alertPerformance.precisionByAlertType?.length ? "ready" : (alertPerformance.totalAlertsTracked ?? 0) > 0 ? "watch" : "blocker",
      detail: `${alertPerformance.totalAlertsTracked ?? 0} alerts are tracked with ${alertPerformance.precisionByAlertType?.length ?? 0} alert types measured. Public beta needs outcome history before aggressive alert language.`
    }
  ];
}

function readinessToneClass(status: ReadinessStatus) {
  if (status === "ready") return "border-terminal-green/40 bg-terminal-green/10 text-terminal-green";
  if (status === "watch") return "border-terminal-amber/40 bg-terminal-amber/10 text-terminal-amber";
  return "border-terminal-red/40 bg-terminal-red/10 text-terminal-red";
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone: "green" | "amber" | "red" | "cyan" }) {
  const color = {
    green: "text-terminal-green",
    amber: "text-terminal-amber",
    red: "text-terminal-red",
    cyan: "text-terminal-cyan"
  }[tone];
  return (
    <div className="border border-terminal-border bg-terminal-panel p-3">
      <div className="text-[10px] uppercase tracking-[0.14em] text-terminal-muted">{label}</div>
      <div className={`mt-2 font-mono text-lg ${color}`}>{value}</div>
    </div>
  );
}
