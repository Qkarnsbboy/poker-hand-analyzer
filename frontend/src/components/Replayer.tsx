import { useEffect, useMemo, useState } from "react";
import { defaultHand } from "../data/default-hand";
import { mockFromUrl } from "../data/mock-analysis";
import type { Hand, Street } from "../lib/hand";
import { STREETS } from "../lib/hand";
import { BigBlindProvider } from "../lib/money";
import { replayAt, streetStartIndex } from "../lib/replay";
import { AnalysisPanel } from "./AnalysisPanel";
import { Controls } from "./Controls";
import { Table } from "./Table";

const PLAY_INTERVAL_MS = 1000;

export function Replayer({ hand, initialIndex }: { hand: Hand; initialIndex: number }) {
  const last = hand.actions.length;
  const [index, setIndex] = useState(initialIndex);
  const [playing, setPlaying] = useState(false);
  const state = useMemo(() => replayAt(hand, index), [hand, index]);

  const streetStarts = useMemo(
    () => Object.fromEntries(STREETS.map((s) => [s, streetStartIndex(hand, s)])) as Record<Street, number | null>,
    [hand],
  );

  // Any manual navigation stops autoplay.
  const seek = (i: number) => {
    setPlaying(false);
    setIndex(Math.max(0, Math.min(i, last)));
  };

  // Autoplay: advance one action per tick, stop at the end.
  useEffect(() => {
    if (!playing) return;
    if (index >= last) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setIndex((i) => i + 1), PLAY_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [playing, index, last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLSelectElement) return;
      const stop = () => setPlaying(false);
      if (e.key === " ") setPlaying((p) => !p);
      else if (e.key === "ArrowRight") (stop(), setIndex((i) => Math.min(i + 1, last)));
      else if (e.key === "ArrowLeft") (stop(), setIndex((i) => Math.max(i - 1, 0)));
      else if (e.key === "Home") (stop(), setIndex(0));
      else if (e.key === "End") (stop(), setIndex(last));
      else if (e.key >= "1" && e.key <= "4") {
        const start = streetStarts[STREETS[Number(e.key) - 1]];
        if (start !== null) (stop(), setIndex(start));
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last, streetStarts]);

  // The mock only makes sense for the hand it was written for; real analysis arrives in slice 3.
  const isMockHand = hand.id === defaultHand.id;

  return (
    <BigBlindProvider value={hand.game.bb}>
    <div className="flex gap-5">
      <main className="w-3/5 rounded-2xl border border-line bg-panel p-5 space-y-5">
        <div className="text-sm font-semibold text-ink-dim">{hand.name}</div>
        <Table hand={hand} state={state} />
        <Controls
          index={index}
          last={last}
          street={state.street}
          streetStarts={streetStarts}
          playing={playing}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onSeek={seek}
        />
      </main>
      <aside className="w-2/5 relative rounded-2xl border border-line bg-panel">
        <AnalysisPanel analysis={state.isDecisionNode && isMockHand ? mockFromUrl() : null} pending={state.isDecisionNode && !isMockHand} />
      </aside>
    </div>
    </BigBlindProvider>
  );
}
