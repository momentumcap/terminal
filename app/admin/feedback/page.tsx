import { getBetaFeedbackSummary, type BetaFeedbackReport } from "@/lib/db/repository";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AdminFeedbackPage() {
  const summary = safeFeedbackSummary();
  const unresolved = summary.open + summary.reviewing;
  return (
    <main className="min-h-screen bg-terminal-bg p-5 text-terminal-text">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-terminal-cyan">Public Beta Operations</div>
          <h1 className="mt-2 font-mono text-3xl font-semibold">Feedback Triage</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-terminal-muted">
            Review user-reported bad data, missing metrics, risk-label concerns, UI bugs, and performance problems before widening beta access.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/beta" className="rounded-lg border border-terminal-border bg-terminal-panel px-3 py-2 font-mono text-xs text-terminal-muted transition hover:border-terminal-green hover:text-terminal-green">Beta Checklist</Link>
          <Link href="/admin/accuracy" className="rounded-lg border border-terminal-border bg-terminal-panel px-3 py-2 font-mono text-xs text-terminal-muted transition hover:border-terminal-amber hover:text-terminal-amber">Accuracy</Link>
          <Link href="/feedback" className="rounded-lg border border-terminal-border bg-terminal-panel px-3 py-2 font-mono text-xs text-terminal-muted transition hover:border-terminal-green hover:text-terminal-green">Submit Report</Link>
          <Link href="/" className="rounded-lg border border-terminal-border bg-terminal-panel px-3 py-2 font-mono text-xs text-terminal-muted transition hover:border-terminal-cyan hover:text-terminal-cyan">Terminal</Link>
        </div>
      </div>

      <section className="grid gap-3 md:grid-cols-4">
        <Stat label="Total Reports" value={summary.total} tone="cyan" />
        <Stat label="Unresolved" value={unresolved} tone={unresolved ? "amber" : "green"} />
        <Stat label="Critical / High" value={`${summary.critical}/${summary.high}`} tone={summary.critical ? "red" : summary.high ? "amber" : "green"} />
        <Stat label="Data Accuracy" value={summary.dataAccuracy} tone={summary.dataAccuracy ? "amber" : "green"} />
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border border-terminal-border bg-terminal-panel p-4">
          <div className="font-mono text-xs uppercase tracking-[0.14em] text-terminal-muted">Report Mix</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-1">
            <Breakdown title="By Category" rows={summary.categoryCounts.map((row) => ({ label: formatCategory(row.category), count: row.count }))} />
            <Breakdown title="By Severity" rows={summary.severityCounts.map((row) => ({ label: row.severity, count: row.count }))} />
          </div>
          <div className="mt-4 rounded-lg border border-terminal-amber/30 bg-terminal-amber/10 p-3 text-xs leading-relaxed text-terminal-amber">
            Public beta should not expand while unresolved critical/high data-accuracy reports remain unreviewed.
          </div>
        </div>

        <div className="rounded-lg border border-terminal-border bg-terminal-panel">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-terminal-border p-3">
            <div>
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-terminal-muted">Recent Reports</div>
              <p className="mt-1 text-xs text-terminal-muted">Newest reports first. Contact is optional and may be blank.</p>
            </div>
            <div className="font-mono text-[11px] text-terminal-muted">Latest {summary.latestAt ?? "none"}</div>
          </div>
          <div className="divide-y divide-terminal-border/70">
            {summary.recent.length ? summary.recent.map((report) => <ReportCard key={report.id} report={report} />) : (
              <div className="p-8 text-center text-sm text-terminal-muted">No feedback reports yet.</div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function ReportCard({ report }: { report: BetaFeedbackReport }) {
  return (
    <article className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${severityClass(report.severity)}`}>{report.severity}</span>
            <span className="rounded-full border border-terminal-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-terminal-muted">{formatCategory(report.category)}</span>
            <span className="rounded-full border border-terminal-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-terminal-muted">{report.status}</span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-terminal-text">{report.title}</h2>
          <div className="mt-1 font-mono text-[11px] text-terminal-muted">{report.id} · {report.createdAt}</div>
        </div>
        {report.tokenAddress && (
          <Link href={`/?analysis=${report.tokenAddress}`} className="rounded-lg border border-terminal-green/40 bg-terminal-green/10 px-3 py-2 font-mono text-xs text-terminal-green transition hover:bg-terminal-green/15">
            Analyze Token
          </Link>
        )}
      </div>
      <div className="mt-3 grid gap-3 text-sm text-terminal-muted lg:grid-cols-2">
        <TextBlock label="Details" value={report.details} />
        <TextBlock label="Expected" value={report.expectedResult ?? "Not provided"} />
        <TextBlock label="Steps" value={report.stepsToReproduce ?? "Not provided"} />
        <div className="rounded-lg border border-terminal-border bg-terminal-bg/50 p-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-terminal-muted">Context</div>
          <div className="mt-2 space-y-1 font-mono text-xs text-terminal-muted">
            <div>token: {report.tokenAddress ?? "none"}</div>
            <div>page: {report.pageUrl ?? "none"}</div>
            <div>contact: {report.contact ?? "none"}</div>
          </div>
        </div>
      </div>
    </article>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-terminal-border bg-terminal-bg/50 p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-terminal-muted">{label}</div>
      <p className="mt-2 leading-relaxed">{value}</p>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) {
  return (
    <div className="rounded-lg border border-terminal-border bg-terminal-bg/50 p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-terminal-muted">{title}</div>
      <div className="mt-3 grid gap-2">
        {rows.length ? rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-terminal-muted">{row.label}</span>
            <span className="font-mono text-terminal-text">{row.count}</span>
          </div>
        )) : <div className="text-sm text-terminal-muted">No reports yet.</div>}
      </div>
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

function safeFeedbackSummary() {
  try {
    return getBetaFeedbackSummary(50);
  } catch {
    return {
      total: 0,
      open: 0,
      reviewing: 0,
      resolved: 0,
      dismissed: 0,
      critical: 0,
      high: 0,
      dataAccuracy: 0,
      latestAt: null,
      categoryCounts: [],
      severityCounts: [],
      recent: []
    };
  }
}

function severityClass(severity: string) {
  if (severity === "critical") return "border-terminal-red/50 bg-terminal-red/10 text-terminal-red";
  if (severity === "high") return "border-terminal-amber/50 bg-terminal-amber/10 text-terminal-amber";
  if (severity === "medium") return "border-terminal-cyan/40 bg-terminal-cyan/10 text-terminal-cyan";
  return "border-terminal-border text-terminal-muted";
}

function formatCategory(category: string) {
  return category.replaceAll("_", " ");
}
