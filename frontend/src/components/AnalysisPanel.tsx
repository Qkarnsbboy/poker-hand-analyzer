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

// Same dark red as the All-in button in the hand builder.
const ALL_IN_STYLE = "bg-red-900 border-red-700";

export function ActionBox({
  rec,
  colorClass,
  allInTotal,
}: {
  rec: AnalyzeResponse["recommendation"];
  colorClass?: string;
  allInTotal?: number; // Hero's whole stack for this street; a bet or raise this big is all-in
}) {
  const { format } = useMoney();

  // A bet or raise of Hero's whole stack shows as "All-in".
  const isAllIn = rec.sizing !== null && allInTotal !== undefined && rec.sizing >= allInTotal;
  const label = isAllIn ? "all-in" : rec.action;
  let color = colorClass ?? ACTION_STYLE[rec.action];
  if (isAllIn) color = ALL_IN_STYLE;

  return (
    <div
      className={color + " h-28 shrink-0 rounded-2xl border-2 text-white flex flex-col items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_8px_rgba(0,0,0,0.3)]"}
    >
      <div className="text-4xl font-black uppercase tracking-wider drop-shadow">
        {label}
        {rec.sizing !== null && <span className="ml-3">{format(rec.sizing)}</span>}
      </div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/80">{rec.confidence} confidence</div>
    </div>
  );
}

// One labeled bucket: a small heading, then its bullets.
interface Bucket {
  label: string;
  bullets: string[]; // empty = bucket is left out (for example, no notes to read)
}

// A section (Theory or Exploitative) that opens and closes on its own.
function Accordion({ title, buckets }: { title: string; buckets: Bucket[] }) {
  const [open, setOpen] = useState(true);

  // Leave out buckets with nothing to say.
  const shown: Bucket[] = [];
  for (const bucket of buckets) {
    if (bucket.bullets.length > 0) shown.push(bucket);
  }

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
        <div className="border-t border-line-strong px-4 py-2.5 space-y-2.5 text-sm leading-snug">
          {shown.map((bucket) => (
            <div key={bucket.label}>
              <div className="text-xs font-bold uppercase tracking-wide text-accent">{bucket.label}</div>
              <ul className="mt-1 space-y-1">
                {bucket.bullets.map((bullet) => (
                  <li key={bullet} className="flex gap-2">
                    <span className="text-ink-faint">•</span>
                    <span className="min-w-0 [overflow-wrap:anywhere]">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The right panel. Shows one of four things depending on `state`.
export function AnalysisPanel({
  state,
  onRetry,
  allInTotal,
}: {
  state: AnalysisState;
  onRetry: () => void;
  allInTotal: number; // Hero's whole stack for this street
}) {
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
  // 4. Got an answer: recommendation box, then the theory and exploitative buckets.
  const analysis = state.data;
  const theory = analysis.theory;
  const exploitative = analysis.exploitative;
  return (
    <div className="absolute inset-4 flex flex-col gap-3 overflow-y-auto no-scrollbar">
      <ActionBox rec={analysis.recommendation} allInTotal={allInTotal} />
      <Accordion
        title="Theory"
        buckets={[
          { label: "Hero's range", bullets: theory.hero_range },
          { label: "Villain's range", bullets: theory.villain_range },
          { label: "Board texture", bullets: theory.board_texture },
          { label: "Bet sizing", bullets: theory.bet_sizing },
        ]}
      />
      <Accordion
        title="Exploitative"
        buckets={[
          { label: "Theory baseline", bullets: exploitative.theory_baseline },
          { label: "Player type", bullets: exploitative.player_type },
          { label: "Reads / notes", bullets: exploitative.reads },
          { label: "Adjustment", bullets: exploitative.adjustment },
        ]}
      />
    </div>
  );
}
