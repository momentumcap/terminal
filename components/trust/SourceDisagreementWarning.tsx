"use client";

export function SourceDisagreementWarning({ warnings }: { warnings: string[] }) {
  const disagreements = warnings.filter((warning) => /differs|disagree/i.test(warning));
  if (!disagreements.length) return null;
  return (
    <div className="border border-terminal-amber/40 bg-terminal-amber/10 p-2 text-xs text-terminal-amber">
      <div className="font-mono uppercase tracking-[0.12em]">Source disagreement detected</div>
      {disagreements.map((warning) => <div key={warning} className="mt-1">{warning}</div>)}
    </div>
  );
}
