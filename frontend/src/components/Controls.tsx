import type { Street } from "../lib/hand";
import { STREETS } from "../lib/hand";

interface Props {
  index: number;
  last: number;
  street: Street;
  streetStarts: Record<Street, number | null>;
  onSeek: (index: number) => void;
}

const LABELS: Record<Street, string> = { preflop: "Pre", flop: "Flop", turn: "Turn", river: "River" };

const btn =
  "rounded-lg border border-neutral-600 bg-neutral-800 py-2 font-semibold hover:bg-neutral-700 disabled:opacity-30 disabled:hover:bg-neutral-800";

export function Controls({ index, last, street, streetStarts, onSeek }: Props) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        <button className={btn} onClick={() => onSeek(0)} disabled={index === 0} title="Home">Restart</button>
        <button className={btn} onClick={() => onSeek(index - 1)} disabled={index === 0} title="←">Back</button>
        <button className={btn} onClick={() => onSeek(index + 1)} disabled={index === last} title="→">Next</button>
        <button className={btn} onClick={() => onSeek(last)} disabled={index === last} title="End">End</button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {STREETS.map((s, i) => {
          const start = streetStarts[s];
          return (
            <button
              key={s}
              className={`${btn} ${s === street ? "border-amber-400 text-amber-300" : ""}`}
              onClick={() => start !== null && onSeek(start)}
              disabled={start === null}
              title={`Key ${i + 1}`}
            >
              {LABELS[s]}
            </button>
          );
        })}
      </div>
      <div className="text-xs text-neutral-500 text-center">← → step · Home / End · 1–4 jump to street</div>
    </div>
  );
}
