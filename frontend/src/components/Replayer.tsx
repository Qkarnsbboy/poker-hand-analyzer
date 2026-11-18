import { useEffect, useMemo, useRef, useState } from "react";
import { mockFromUrl } from "../data/mock-analysis";
import { fetchAnalysis, type AnalyzeResponse } from "../lib/analysis";
import type { Hand, Street } from "../lib/hand";
import { STREETS } from "../lib/hand";
import { BigBlindProvider } from "../lib/money";
import { replayAt, streetStartIndex } from "../lib/replay";
import { AnalysisPanel } from "./AnalysisPanel";
import { Controls } from "./Controls";
import { Table } from "./Table";

const PLAY_INTERVAL_MS = 1000;

// What the right panel is showing right now.
export type AnalysisState =
  | { kind: "none" } // not hero's turn: empty panel
  | { kind: "loading" } // waiting on the backend
  | { kind: "error"; message: string } // request failed
  | { kind: "ready"; data: AnalyzeResponse }; // got an answer

// Dev preview: ?mock=... or ?long shows canned analysis instead of calling the backend.
const USE_MOCK = /[?&](mock|long)\b/.test(window.location.search);

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

  // Analysis for hero decisions, fetched on arrival and cached per action for this hand.
  const cache = useRef(new Map<number, AnalyzeResponse>()); // action index -> answer
  const [analysis, setAnalysis] = useState<AnalysisState>({ kind: "none" });
  const [retry, setRetry] = useState(0); // bumping this re-runs the effect below

  // Runs every time the user lands on a new action.
  useEffect(() => {
    // Not hero's turn: nothing to show.
    if (!state.isDecisionNode) return setAnalysis({ kind: "none" });
    // Dev preview mode: use canned text.
    if (USE_MOCK) return setAnalysis({ kind: "ready", data: mockFromUrl() });
    // Already asked about this action: reuse the answer.
    const cached = cache.current.get(index);
    if (cached) return setAnalysis({ kind: "ready", data: cached });

    // Otherwise ask the backend.
    setAnalysis({ kind: "loading" });
    const ctrl = new AbortController();
    fetchAnalysis(hand, index, ctrl.signal)
      .then((data) => {
        if (data.action_index !== index) return; // answer for an old action, ignore it
        cache.current.set(index, data);
        setAnalysis({ kind: "ready", data });
      })
      .catch((e: Error) => {
        // Cancelled on purpose (user moved on) isn't an error.
        if (!ctrl.signal.aborted) setAnalysis({ kind: "error", message: e.message });
      });
    // Cleanup: if the user moves on before the answer arrives, cancel the request.
    return () => ctrl.abort();
  }, [hand, index, state.isDecisionNode, retry]);

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
        <AnalysisPanel state={analysis} onRetry={() => setRetry((n) => n + 1)} />
      </aside>
    </div>
    </BigBlindProvider>
  );
}
