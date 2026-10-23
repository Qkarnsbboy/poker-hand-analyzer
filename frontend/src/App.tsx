import { useEffect, useMemo, useState } from "react";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { Controls } from "./components/Controls";
import { Table } from "./components/Table";
import { defaultHand, DEFAULT_INDEX } from "./data/default-hand";
import type { Street } from "./lib/hand";
import { STREETS } from "./lib/hand";
import { replayAt, streetStartIndex } from "./lib/replay";

const headerBtn = "rounded-lg border border-neutral-600 px-3 py-1 text-sm disabled:opacity-40";

export default function App() {
  const hand = defaultHand;
  const last = hand.actions.length;
  const [index, setIndex] = useState(DEFAULT_INDEX);
  const state = useMemo(() => replayAt(hand, index), [hand, index]);

  const streetStarts = useMemo(
    () => Object.fromEntries(STREETS.map((s) => [s, streetStartIndex(hand, s)])) as Record<Street, number | null>,
    [hand],
  );

  const seek = (i: number) => setIndex(Math.max(0, Math.min(i, last)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, last));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
      else if (e.key === "Home") setIndex(0);
      else if (e.key === "End") setIndex(last);
      else if (e.key >= "1" && e.key <= "4") {
        const start = streetStarts[STREETS[Number(e.key) - 1]];
        if (start !== null) setIndex(start);
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last, streetStarts]);

  return (
    <div className="min-h-full bg-neutral-950 text-neutral-100 p-6">
      <div className="max-w-6xl mx-auto rounded-3xl border border-neutral-700 bg-neutral-900 p-5">
        <header className="flex justify-between items-center mb-5">
          <h1 className="text-xl font-bold">Poker Hand Analyzer</h1>
          <div className="flex gap-2">
            {/* Wired up in slice 2 */}
            <button className={headerBtn} disabled title="Coming in slice 2">New Hand</button>
            <button className={headerBtn} disabled title="Not in v1">View Hands</button>
          </div>
        </header>
        <div className="flex gap-5">
          <main className="w-3/5 rounded-2xl border border-neutral-700 bg-neutral-800/50 p-5 space-y-5">
            <Table hand={hand} state={state} />
            <Controls index={index} last={last} street={state.street} streetStarts={streetStarts} onSeek={seek} />
          </main>
          <aside className="w-2/5 rounded-2xl border border-neutral-700 bg-neutral-800/50 p-4">
            <AnalysisPanel isDecisionNode={state.isDecisionNode} />
          </aside>
        </div>
      </div>
    </div>
  );
}
