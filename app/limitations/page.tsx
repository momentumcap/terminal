import Link from "next/link";

const sections = [
  {
    title: "Not Financial Advice",
    body: "Momentum Terminal does not tell you what to buy or sell. Scores, alerts, and summaries are decision-support signals and can be wrong."
  },
  {
    title: "Market Data Can Disagree",
    body: "DexScreener, GeckoTerminal, and onchain reads can differ because of cache timing, pool coverage, pair selection, and aggregation windows. When providers disagree, confidence should be downgraded."
  },
  {
    title: "Holder Counts Are Hard",
    body: "Complete holder counts require full historical indexing or reliable explorer coverage. RPC-based holder reconstruction is partial unless every transfer from token creation is indexed."
  },
  {
    title: "Buys and Sells Are Contextual",
    body: "Provider buy/sell counts and Base RPC swap-log windows may not match. RPC windows are pool-specific and only complete when supported pools and block ranges are fully indexed."
  },
  {
    title: "Contract Risk Is Not Safety",
    body: "No critical risk detected does not mean safe. Contract risk may be unavailable when verified source, ABI, honeypot simulation, or tax simulation is missing."
  },
  {
    title: "Bankr Credibility Is Not Safety",
    body: "A credible creator, verified account, or high follower count does not make a token safe. Bankr launches are unfiltered and must be verified independently."
  },
  {
    title: "Social Momentum Is Noisy",
    body: "X, Reddit, and other social sources can be rate-limited, paid, botted, missing, or delayed. Narrative strength is a monitoring signal, not proof of organic demand."
  },
  {
    title: "Public APIs Have Limits",
    body: "Public endpoints can be cached, delayed, unavailable, or rate-limited. The terminal should show stale, missing, and provider-error states instead of hiding them."
  }
];

export default function LimitationsPage() {
  return (
    <main className="min-h-screen bg-terminal-bg p-5 text-terminal-text">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-terminal-amber">Public Beta Readiness</div>
            <h1 className="mt-2 font-mono text-3xl font-semibold">Momentum Terminal Limitations</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-terminal-muted">
              This page exists to keep the product honest. When we know, we show evidence. When we do not know, we say so.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="rounded-lg border border-terminal-border bg-terminal-panel px-3 py-2 font-mono text-xs text-terminal-muted transition hover:border-terminal-green hover:text-terminal-green">
              Back to Terminal
            </Link>
            <Link href="/analysis" className="rounded-lg border border-terminal-green/40 bg-terminal-green/10 px-3 py-2 font-mono text-xs text-terminal-green transition hover:border-terminal-green hover:text-terminal-text">
              Analysis Engine
            </Link>
            <Link href="/feedback" className="rounded-lg border border-terminal-amber/40 bg-terminal-amber/10 px-3 py-2 font-mono text-xs text-terminal-amber transition hover:border-terminal-amber hover:text-terminal-text">
              Report Issue
            </Link>
            <Link href="/status" className="rounded-lg border border-terminal-cyan/40 bg-terminal-cyan/10 px-3 py-2 font-mono text-xs text-terminal-cyan transition hover:border-terminal-cyan hover:text-terminal-text">
              System Status
            </Link>
          </div>
        </div>

        <section className="rounded-lg border border-terminal-amber/35 bg-terminal-amber/10 p-4 text-sm text-terminal-amber">
          <div className="font-mono text-xs uppercase tracking-[0.14em]">Trading Risk</div>
          <p className="mt-2 leading-relaxed">
            Crypto tokens can go to zero. Liquidity can disappear. Sells can fail. Owners can change contract behavior. Momentum Terminal helps surface evidence, but it cannot guarantee safety, profitability, or sellability.
          </p>
        </section>

        <section className="mt-5 grid gap-3 md:grid-cols-2">
          {sections.map((section) => (
            <article key={section.title} className="rounded-lg border border-terminal-border bg-terminal-panel p-4">
              <h2 className="font-mono text-sm text-terminal-cyan">{section.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-terminal-muted">{section.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-5 rounded-lg border border-terminal-border bg-terminal-panel p-4">
          <h2 className="font-mono text-sm text-terminal-green">Public Beta Gate</h2>
          <div className="mt-3 grid gap-2 text-sm text-terminal-muted md:grid-cols-2">
            <Check text="Data source, confidence, freshness, and warning states must be visible." />
            <Check text="Provider health and source disagreement must be monitored." />
            <Check text="Critical estimates must be labeled as estimated or partial." />
            <Check text="Unknown risk must never be presented as safe." />
            <Check text="API keys, rate limits, logging, and deployment monitoring must be configured." />
            <Check text="Users must see limitations before relying on trading intelligence." />
          </div>
        </section>
      </div>
    </main>
  );
}

function Check({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-terminal-border bg-terminal-bg/50 p-3">
      {text}
    </div>
  );
}
