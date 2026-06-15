import { BaseTokenAnalysisEngine } from "@/components/analysis/BaseTokenAnalysisEngine";
import { BetaDisclosure } from "@/components/beta/BetaDisclosure";
import { BetaReadinessBanner } from "@/components/beta/BetaReadinessBanner";
import { TrustStatusStrip } from "@/components/trust/TrustStatusStrip";
import Link from "next/link";

export default async function AnalysisPage({ searchParams }: { searchParams: Promise<{ address?: string }> }) {
  const params = await searchParams;
  const selectedAddress = typeof params.address === "string" ? params.address : null;

  return (
    <div className="min-h-screen bg-terminal-bg">
      <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-terminal-border bg-terminal-panel/95 px-4 py-3 shadow-panel backdrop-blur">
        <Link href="/" className="rounded-lg border border-terminal-border bg-terminal-bg/70 px-3 py-2 text-xs font-semibold text-terminal-muted transition hover:border-terminal-green hover:text-terminal-green">
          Back to Terminal
        </Link>
        <div className="min-w-[260px] flex-1">
          <TrustStatusStrip compact />
        </div>
        <div className="min-w-[220px] flex-1">
          <BetaReadinessBanner compact />
        </div>
        <BetaDisclosure compact />
        <div className="text-xs text-terminal-muted">Analysis Engine · exact Base contract only</div>
      </div>
      <BaseTokenAnalysisEngine selectedAddress={selectedAddress} />
    </div>
  );
}
