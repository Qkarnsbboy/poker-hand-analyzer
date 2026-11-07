import type { AnalyzeResponse, RecommendedAction } from "../lib/analysis";

// Fixed colors, the same in every theme: green = call/check, blue = fold, red = bet/raise.
const ACTION_STYLE: Record<RecommendedAction, string> = {
  call: "bg-green-600 border-green-400",
  check: "bg-green-600 border-green-400",
  fold: "bg-blue-600 border-blue-400",
  bet: "bg-red-600 border-red-400",
  raise: "bg-red-600 border-red-400",
};

function ActionBox({ rec }: { rec: AnalyzeResponse["recommendation"] }) {
  return (
    <div
      className={`${ACTION_STYLE[rec.action]} rounded-2xl border-2 text-white flex flex-col items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_8px_rgba(0,0,0,0.3)]`}
    >
      <div className="text-5xl font-black uppercase tracking-wider drop-shadow">
        {rec.action}
        {rec.sizing !== null && <span className="ml-3">${rec.sizing}</span>}
      </div>
      <div className="mt-2 text-sm font-semibold uppercase tracking-wide text-white/80">{rec.confidence} confidence</div>
    </div>
  );
}

function ReasonBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-line-strong bg-raised flex flex-col overflow-hidden">
      <div className="px-4 py-2 border-b border-line-strong bg-black/10 font-bold uppercase tracking-wide text-sm text-ink-dim">
        {title}
      </div>
      <ul className="flex-1 overflow-y-auto px-4 py-2.5 space-y-1.5 text-sm leading-snug">
        {items.map((t) => (
          <li key={t} className="flex gap-2">
            <span className="text-accent">•</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AnalysisPanel({ analysis }: { analysis: AnalyzeResponse | null }) {
  if (!analysis) return null; // empty at non-decision nodes
  return (
    <div className="absolute inset-4 grid grid-rows-3 gap-3">
      <ActionBox rec={analysis.recommendation} />
      <ReasonBox title="Theory" items={analysis.theory} />
      <ReasonBox title="Exploitative" items={analysis.exploitative} />
    </div>
  );
}
