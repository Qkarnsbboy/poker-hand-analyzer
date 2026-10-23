import { useEffect, useMemo, useState } from "react";
import { Controls } from "./components/Controls";
import { Table } from "./components/Table";
import { defaultHand, DEFAULT_INDEX } from "./data/default-hand";
import type { Street } from "./lib/hand";
import { STREETS } from "./lib/hand";
import { replayAt, streetStartIndex } from "./lib/replay";

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
    <div className="p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Poker Hand Analyzer</h1>
      </header>
      <div className="flex gap-6">
        <main className="w-3/5 space-y-6">
          <Table hand={hand} state={state} />
          <Controls index={index} last={last} street={state.street} streetStarts={streetStarts} onSeek={seek} />
        </main>
        <aside className="w-2/5 border border-dashed border-gray-300 p-4 text-sm text-gray-400">
          Analysis panel (slice 3)
        </aside>
      </div>
    </div>
  );
}
