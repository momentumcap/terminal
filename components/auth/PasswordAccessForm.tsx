"use client";

import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";

export function PasswordAccessForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextPath = useMemo(() => {
    if (typeof window === "undefined") return "/";
    const requested = new URLSearchParams(window.location.search).get("next");
    return requested?.startsWith("/") ? requested : "/";
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || "Unable to unlock Momentum Terminal.");
      }

      window.location.assign(nextPath);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to unlock Momentum Terminal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[2rem] border border-white/12 bg-slate-950/82 p-5 shadow-2xl shadow-cyan-950/30 backdrop-blur md:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-200">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-200">Private Access</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Enter the beta password</h1>
        </div>
      </div>

      <label htmlFor="terminal-password" className="mb-2 block text-sm font-medium text-slate-200">
        Password
      </label>
      <input
        id="terminal-password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
        autoFocus
        placeholder="Paste your access password"
        className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-900/90 px-4 text-base text-white outline-none transition focus:border-cyan-300 focus:ring-4 focus:ring-cyan-300/10"
      />

      {error ? (
        <p className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || !password.trim()}
        className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 text-sm font-bold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Checking Access" : "Enter Terminal"}
        <ArrowRight className="h-4 w-4" />
      </button>

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/8 px-4 py-3 text-sm text-amber-100">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>This gate protects the private beta. Market intelligence still requires independent contract, liquidity, and sellability verification.</p>
      </div>
    </form>
  );
}

