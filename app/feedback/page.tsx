"use client";

import { AlertTriangle, CheckCircle2, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const categories = [
  { value: "bad_data", label: "Bad Data" },
  { value: "missing_data", label: "Missing Data" },
  { value: "wrong_risk", label: "Wrong Risk Label" },
  { value: "ui_bug", label: "UI Bug" },
  { value: "performance", label: "Slow / Frozen" },
  { value: "feature_request", label: "Feature Request" },
  { value: "other", label: "Other" }
];

const severities = [
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
  { value: "low", label: "Low" }
];

const fieldClass = "w-full rounded-lg border border-terminal-border bg-terminal-bg/80 px-3 py-2 text-sm text-terminal-text outline-none transition placeholder:text-terminal-muted focus:border-terminal-green focus:ring-2 focus:ring-terminal-green/10";

export default function FeedbackPage() {
  const [category, setCategory] = useState("bad_data");
  const [severity, setSeverity] = useState("medium");
  const [tokenAddress, setTokenAddress] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTokenAddress(params.get("token") ?? "");
    setPageUrl(params.get("page") ?? document.referrer ?? "");
  }, []);

  const canSubmit = useMemo(() => title.trim().length >= 5 && details.trim().length >= 15 && status !== "submitting", [details, status, title]);

  async function submit() {
    if (!canSubmit) return;
    setStatus("submitting");
    setMessage("");
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        category,
        severity,
        tokenAddress: tokenAddress.trim() || null,
        pageUrl: pageUrl.trim() || null,
        title,
        details,
        expectedResult: expectedResult.trim() || null,
        stepsToReproduce: stepsToReproduce.trim() || null,
        contact: contact.trim() || null,
        context: {
          capturedAt: new Date().toISOString(),
          app: "Momentum Terminal Public Beta"
        }
      })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      setStatus("error");
      setMessage(data?.error ?? "Could not submit the report. Check the required fields and try again.");
      return;
    }
    setStatus("success");
    setMessage(`Report saved: ${data.report?.id ?? "received"}`);
    setTitle("");
    setDetails("");
    setExpectedResult("");
    setStepsToReproduce("");
  }

  return (
    <main className="min-h-screen bg-terminal-bg p-5 text-terminal-text">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-terminal-cyan">Public Beta Feedback</div>
            <h1 className="mt-2 font-mono text-3xl font-semibold">Report a Momentum Terminal issue</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-terminal-muted">
              Use this for wrong holder counts, bad market caps, missing buys/sells, suspicious risk labels, or broken UI. The more evidence you include, the faster we can fix it.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/" className="rounded-lg border border-terminal-border bg-terminal-panel px-3 py-2 font-mono text-xs text-terminal-muted transition hover:border-terminal-green hover:text-terminal-green">Terminal</Link>
            <Link href="/admin/accuracy" className="rounded-lg border border-terminal-border bg-terminal-panel px-3 py-2 font-mono text-xs text-terminal-muted transition hover:border-terminal-amber hover:text-terminal-amber">Accuracy</Link>
          </div>
        </div>

        <section className="rounded-lg border border-terminal-amber/35 bg-terminal-amber/10 p-4 text-sm text-terminal-amber">
          <div className="flex gap-2">
            <AlertTriangle size={17} />
            <div>
              <div className="font-mono text-xs uppercase tracking-[0.14em]">Data accuracy reports are highest priority</div>
              <p className="mt-1 text-terminal-muted">If a displayed value conflicts with DexScreener, GeckoTerminal, Blockscout, BaseScan, or onchain evidence, include the source and exact value you expected.</p>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-lg border border-terminal-border bg-terminal-panel p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Category">
                <select value={category} onChange={(event) => setCategory(event.target.value)} className={fieldClass}>
                  {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </Field>
              <Field label="Severity">
                <select value={severity} onChange={(event) => setSeverity(event.target.value)} className={fieldClass}>
                  {severities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </Field>
              <Field label="Token contract address">
                <input value={tokenAddress} onChange={(event) => setTokenAddress(event.target.value)} className={fieldClass} placeholder="0x..." />
              </Field>
              <Field label="Page URL">
                <input value={pageUrl} onChange={(event) => setPageUrl(event.target.value)} className={fieldClass} placeholder="Where did you see the issue?" />
              </Field>
            </div>

            <div className="mt-3 grid gap-3">
              <Field label="Short title">
                <input value={title} onChange={(event) => setTitle(event.target.value)} className={fieldClass} placeholder="Example: VEIL holder count is too low" />
              </Field>
              <Field label="What is wrong?">
                <textarea value={details} onChange={(event) => setDetails(event.target.value)} className={`${fieldClass} min-h-32 resize-y`} placeholder="Tell us the exact number, label, chart, token, or panel that looks wrong." />
              </Field>
              <Field label="What should it show?">
                <textarea value={expectedResult} onChange={(event) => setExpectedResult(event.target.value)} className={`${fieldClass} min-h-24 resize-y`} placeholder="Include external source links, screenshots notes, or expected values when possible." />
              </Field>
              <Field label="Steps to reproduce">
                <textarea value={stepsToReproduce} onChange={(event) => setStepsToReproduce(event.target.value)} className={`${fieldClass} min-h-24 resize-y`} placeholder="Example: Open Analysis, paste contract, compare Holder Analysis to Blockscout." />
              </Field>
              <Field label="Contact optional">
                <input value={contact} onChange={(event) => setContact(event.target.value)} className={fieldClass} placeholder="Email, X handle, Discord, or leave blank" />
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button disabled={!canSubmit} onClick={submit} className="inline-flex items-center gap-2 rounded-lg border border-terminal-green/50 bg-terminal-green/10 px-4 py-3 font-mono text-xs uppercase tracking-[0.12em] text-terminal-green transition hover:bg-terminal-green/15 disabled:cursor-not-allowed disabled:opacity-40">
                <Send size={14} />
                {status === "submitting" ? "Sending" : "Submit Report"}
              </button>
              {message && (
                <span className={`inline-flex items-center gap-2 text-sm ${status === "success" ? "text-terminal-green" : "text-terminal-red"}`}>
                  {status === "success" && <CheckCircle2 size={15} />}
                  {message}
                </span>
              )}
            </div>
          </div>

          <aside className="rounded-lg border border-terminal-border bg-terminal-panel p-4">
            <div className="font-mono text-sm text-terminal-green">Good reports include</div>
            <div className="mt-3 grid gap-2 text-sm text-terminal-muted">
              <Guide text="Exact contract address and symbol." />
              <Guide text="The panel or metric that looks wrong." />
              <Guide text="The value Momentum Terminal showed." />
              <Guide text="The value another source showed." />
              <Guide text="Source name and link when possible." />
              <Guide text="Whether the issue repeats after refresh." />
            </div>
            <div className="mt-4 rounded-lg border border-terminal-border bg-terminal-bg/50 p-3 text-xs leading-relaxed text-terminal-muted">
              Feedback is stored locally in the Momentum Terminal SQLite database for this MVP. Before production, route this to your team inbox, issue tracker, or support database.
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-terminal-muted">{label}</span>
      {children}
    </label>
  );
}

function Guide({ text }: { text: string }) {
  return <div className="rounded-md border border-terminal-border bg-terminal-bg/50 p-3">{text}</div>;
}
