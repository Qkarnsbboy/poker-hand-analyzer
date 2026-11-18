import { useState } from "react";
import type { AnalyzeResponse, RecommendedAction } from "../lib/analysis";
import { useMoney } from "../lib/money";
import type { AnalysisState } from "./Replayer";

// Fixed colors, the same in every theme: green = call, grey = check, blue = fold, red = bet/raise.
const ACTION_STYLE: Record<RecommendedAction, string> = {
  call: "bg-green-600 border-green-400",
  check: "bg-slate-500 border-slate-300",
  fold: "bg-blue-600 border-blue-400",
  bet: "bg-red-600 border-red-400",
  raise: "bg-red-600 border-red-400",
};

export function ActionBox({ rec, colorClass }: { rec: AnalyzeResponse["recommendation"]; colorClass?: string }) {
  const { format } = useMoney();
  return (
    <div
      className={(colorClass ?? ACTION_STYLE[rec.action]) + " h-28 shrink-0 rounded-2xl border-2 text-white flex flex-col items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_8px_rgba(0,0,0,0.3)]"}
    >
      <div className="text-4xl font-black uppercase tracking-wider drop-shadow">
        {rec.action}
        {rec.sizing !== null && <span className="ml-3">{format(rec.sizing)}</span>}
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

// The right panel. Shows one of four things depending on `state`.
export function AnalysisPanel({ state, onRetry }: { state: AnalysisState; onRetry: () => void }) {
  // 1. Not hero's turn: empty.
  if (state.kind === "none") return null;

  // 2. Waiting: spinner.
  if (state.kind === "loading") {
    return (
      <div className="absolute inset-4 flex flex-col items-center justify-center gap-3 text-ink-faint">
        <div className="w-8 h-8 rounded-full border-4 border-line-strong border-t-accent animate-spin" />
        Analyzing...
      </div>
    );
  }
  // 3. Failed: warning + retry button.
  if (state.kind === "error") {
    return (
      <div className="absolute inset-4 flex flex-col items-center justify-center gap-2 text-center">
        <span className="text-3xl text-amber-400" aria-hidden>⚠</span>
        <span className="font-bold">Analysis unavailable</span>
        <span className="text-xs text-ink-faint max-w-xs">{state.message}</span>
        <button type="button" onClick={onRetry} className="mt-2 rounded-md bg-ink px-3 py-1 text-sm font-semibold text-page hover:opacity-85">
          Retry
        </button>
      </div>
    );
  }
  // 4. Got an answer: recommendation box, then theory and exploitative lists.
  const analysis = state.data;
  return (
    <div className="absolute inset-4 flex flex-col gap-3 overflow-y-auto no-scrollbar">
      <ActionBox rec={analysis.recommendation} />
      <Accordion title="Theory" items={analysis.theory} />
      <Accordion title="Exploitative" items={analysis.exploitative} />
    </div>
  );
}
