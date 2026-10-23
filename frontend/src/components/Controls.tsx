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

export function Controls({ index, last, street, streetStarts, onSeek }: Props) {
  const btn = "border border-gray-400 px-3 py-1 disabled:opacity-30";
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button className={btn} onClick={() => onSeek(0)} disabled={index === 0}>Restart</button>
        <button className={btn} onClick={() => onSeek(index - 1)} disabled={index === 0}>Back</button>
        <button className={btn} onClick={() => onSeek(index + 1)} disabled={index === last}>Next</button>
        <button className={btn} onClick={() => onSeek(last)} disabled={index === last}>End</button>
      </div>
      <div className="flex gap-2">
        {STREETS.map((s, i) => {
          const start = streetStarts[s];
          return (
            <button
              key={s}
              className={`${btn} ${s === street ? "bg-gray-200" : ""}`}
              onClick={() => start !== null && onSeek(start)}
              disabled={start === null}
              title={`Key ${i + 1}`}
            >
              {LABELS[s]}
            </button>
          );
        })}
      </div>
      <div className="text-xs text-gray-500">
        ← → step · Home / End · 1–4 jump to street · action {index} / {last}
      </div>
    </div>
  );
}
