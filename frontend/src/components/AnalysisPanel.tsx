// Layout only. Real analysis arrives in slice 3 via POST /analyze.
export function AnalysisPanel({ isDecisionNode }: { isDecisionNode: boolean }) {
  if (!isDecisionNode) return null; // empty at non-decision nodes
  const box = "rounded-2xl border border-neutral-600 bg-neutral-900 p-4";
  return (
    <div className="space-y-3">
      <div className={`${box} py-8 text-center text-4xl font-bold tracking-wide text-neutral-500`}>—</div>
      <div className={box}>
        <div className="font-semibold text-center mb-2">Theory</div>
        <div className="text-sm text-neutral-500 text-center">Analysis coming in slice 3</div>
      </div>
      <div className={box}>
        <div className="font-semibold text-center mb-2">Exploitative</div>
        <div className="text-sm text-neutral-500 text-center">Analysis coming in slice 3</div>
      </div>
    </div>
  );
}
