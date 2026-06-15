import { Activity, DatabaseZap, Radar, ShieldAlert } from "lucide-react";
import { PasswordAccessForm } from "../../components/auth/PasswordAccessForm";

const pillars = [
  {
    icon: Radar,
    title: "Launch Radar",
    copy: "Base token discovery, Bankr launch scanning, and early signal triage."
  },
  {
    icon: Activity,
    title: "Trading Intelligence",
    copy: "Momentum, liquidity, buy pressure, breakout watch, and live alerts."
  },
  {
    icon: DatabaseZap,
    title: "Source-Aware Data",
    copy: "Provider confidence, freshness, provenance, and missing-data warnings."
  },
  {
    icon: ShieldAlert,
    title: "Risk First",
    copy: "Contract, holder, deployer, and liquidity risk surfaced without safety claims."
  }
];

export default function AccessPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#07090d] text-slate-100">
      <section className="relative isolate min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_84%_12%,rgba(52,211,153,0.12),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.96),#07090d_70%)]" />
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col">
          <header className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">Momentum Terminal</p>
              <p className="mt-1 text-sm text-slate-400">Base token intelligence operating system</p>
            </div>
            <div className="hidden rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100 sm:block">
              Private Beta
            </div>
          </header>

          <div className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:py-12">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
                Password protected public access
              </div>
              <h2 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Base market intelligence, protected until the beta is ready.
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                Momentum Terminal is being prepared for serious traders: real-time discovery, transparent data quality, risk-aware scoring, and tactical analysis without pretending unknowns are facts.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {pillars.map((pillar) => {
                  const Icon = pillar.icon;
                  return (
                    <div key={pillar.title} className="rounded-3xl border border-white/10 bg-slate-950/45 p-4 backdrop-blur">
                      <Icon className="mb-3 h-5 w-5 text-cyan-200" />
                      <h3 className="font-semibold text-white">{pillar.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-400">{pillar.copy}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mx-auto w-full max-w-md">
              <PasswordAccessForm />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

