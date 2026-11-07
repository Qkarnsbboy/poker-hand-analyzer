// Layout only. Real analysis arrives in slice 3 via POST /analyze.
export function AnalysisPanel({ isDecisionNode }: { isDecisionNode: boolean }) {
  if (!isDecisionNode) return null; // empty at non-decision nodes
  const box = "rounded-2xl border border-line-strong bg-raised p-4";
  return (
    <div className="space-y-3">
      <div className={`${box} py-8 text-center text-4xl font-bold tracking-wide text-ink-faint`}>—</div>
      <div className={box}>
        <div className="font-semibold text-center mb-2">Theory</div>
        <div className="text-sm text-ink-faint text-center">Analysis coming in slice 3</div>
      </div>
      <div className={box}>
        <div className="font-semibold text-center mb-2">Exploitative</div>
        <div className="text-sm text-ink-faint text-center">Analysis coming in slice 3</div>
      </div>
    </div>
  );
}
