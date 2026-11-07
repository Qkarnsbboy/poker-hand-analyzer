import { useState } from "react";
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
      className={ACTION_STYLE[rec.action] + " h-28 shrink-0 rounded-2xl border-2 text-white flex flex-col items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_8px_rgba(0,0,0,0.3)]"}
    >
      <div className="text-4xl font-black uppercase tracking-wider drop-shadow">
        {rec.action}
        {rec.sizing !== null && <span className="ml-3">${rec.sizing}</span>}
      </div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/80">{rec.confidence} confidence</div>
    </div>
  );
}

// Each section opens and closes on its own.
function Accordion({ title, items }: { title: string; items: string[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="shrink-0 rounded-2xl border border-line-strong bg-raised overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2 bg-black/10 hover:bg-black/20 font-bold uppercase tracking-wide text-sm text-ink-dim"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className={"w-4 h-4 transition-transform " + (open ? "rotate-180" : "")}>
          <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4z" />
        </svg>
      </button>
      {open && (
        <ul className="border-t border-line-strong px-4 py-2.5 space-y-1.5 text-sm leading-snug">
          {items.map((t) => (
            <li key={t} className="flex gap-2">
              <span className="text-accent">•</span>
              <span className="min-w-0 [overflow-wrap:anywhere]">{t}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AnalysisPanel({ analysis }: { analysis: AnalyzeResponse | null }) {
  if (!analysis) return null; // empty at non-decision nodes
  return (
    <div className="absolute inset-4 flex flex-col gap-3 overflow-y-auto no-scrollbar">
      <ActionBox rec={analysis.recommendation} />
      <Accordion title="Theory" items={analysis.theory} />
      <Accordion title="Exploitative" items={analysis.exploitative} />
    </div>
  );
}
