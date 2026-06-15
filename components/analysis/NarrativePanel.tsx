"use client";

import { MetricGrid, PanelTitle } from "@/components/analysis/MomentumPanel";
import type { NarrativeMetrics } from "@/lib/analysis/types";

export function NarrativePanel({ metrics }: { metrics: NarrativeMetrics }) {
  const social = metrics.socialMomentum;
  return (
    <section className="border border-terminal-border bg-terminal-panel p-4">
      <PanelTitle title="Narrative & Social Analysis" />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex border border-terminal-cyan/40 bg-terminal-cyan/10 px-3 py-2 font-mono text-sm text-terminal-cyan">{metrics.category}</div>
        {social && <div className="inline-flex border border-terminal-green/30 bg-terminal-green/10 px-3 py-2 font-mono text-xs text-terminal-green">{social.trendLabel} · {social.dataQuality.confidence} confidence</div>}
      </div>
      <MetricGrid items={[
        ["Social Velocity", `${metrics.socialVelocity.toFixed(0)}`],
        ["Mentions", `${metrics.mentionAcceleration.toFixed(0)}`],
        ["Community", `${metrics.communityGrowth.toFixed(0)}`],
        ["Narrative", `${metrics.NarrativeStrengthScore.toFixed(0)}`]
      ]} />
      {social && (
        <>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4">
            <SocialCell label="1h mentions" value={social.mentionCount1h} />
            <SocialCell label="6h mentions" value={social.mentionCount6h} />
            <SocialCell label="24h mentions" value={social.mentionCount24h} />
            <SocialCell label="Unique authors" value={social.uniqueAuthors24h} />
            <SocialCell label="Engagement" value={social.engagement24h} />
            <SocialCell label="Sentiment" value={`${social.sentiment} ${social.sentimentScore.toFixed(0)}`} />
            <SocialCell label="Influencers" value={social.influencerActivityScore.toFixed(0)} />
            <SocialCell label="Bot risk" value={social.botRiskScore.toFixed(0)} tone={social.botRiskScore > 65 ? "risk" : "ok"} />
          </div>
          <div className="mt-3 border border-terminal-border bg-[#0a0f16] p-3 text-xs">
            <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-terminal-muted">Social Data Provenance</div>
            <div className="font-mono text-terminal-text">Sources: {social.dataQuality.sourcesTried.join(" + ") || "none"} · Query: {social.queryTerms.join(" / ")}</div>
            <div className="mt-1 text-terminal-muted">Warnings: {social.dataQuality.warnings.join(" | ") || "None"}</div>
          </div>
          <div className="mt-3 grid gap-2">
            {social.topPosts.length ? social.topPosts.map((post, index) => (
              <a key={`${post.source}-${post.id}-${index}`} href={post.url} target="_blank" rel="noreferrer" className="block border border-terminal-border bg-[#0a0f16] p-3 text-xs transition hover:border-terminal-green/50">
                <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-terminal-muted">
                  <span>{post.source.toUpperCase()} · {post.author ?? "unknown"}</span>
                  <span>{new Date(post.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="mt-2 line-clamp-2 text-terminal-text">{post.text}</div>
              </a>
            )) : <div className="border border-terminal-border bg-[#0a0f16] p-3 text-xs text-terminal-muted">No live social posts available yet. Add an X bearer token for real-time social monitoring.</div>}
          </div>
        </>
      )}
      <div className="mt-3 space-y-2 text-xs text-terminal-muted">{metrics.signals.map((signal, index) => <div key={`${signal}-${index}`} className="border border-terminal-border bg-[#0a0f16] p-2">{signal}</div>)}</div>
    </section>
  );
}

function SocialCell({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: "neutral" | "ok" | "risk" }) {
  return (
    <div className="border border-terminal-border bg-[#0a0f16] p-2">
      <div className="text-[10px] uppercase tracking-[0.12em] text-terminal-muted">{label}</div>
      <div className={tone === "risk" ? "mt-1 font-mono text-sm text-terminal-red" : tone === "ok" ? "mt-1 font-mono text-sm text-terminal-green" : "mt-1 font-mono text-sm text-terminal-text"}>{value}</div>
    </div>
  );
}
