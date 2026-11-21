import { useEffect, useMemo, useState } from "react";
import { mockFromUrl } from "../data/mock-analysis";
import { analyzeWholeHand, getAnalysis, knownAnswer, LockedError, type AnalyzeResponse } from "../lib/analysis";
import type { Hand, Street } from "../lib/hand";
import { STREETS } from "../lib/hand";
import { BigBlindProvider } from "../lib/money";
import { replayAt, replaySteps, streetStartIndex } from "../lib/replay";
import { AnalysisPanel } from "./AnalysisPanel";
import { Controls } from "./Controls";
import { Table } from "./Table";

const PLAY_INTERVAL_MS = 1000;

// What the right panel is showing right now.
export type AnalysisState =
  | { kind: "none" } // not hero's turn: empty panel
  | { kind: "loading" } // waiting on the backend
  | { kind: "locked" } // guest's own hand: sign in to see analysis
  | { kind: "error"; message: string } // request failed
  | { kind: "ready"; data: AnalyzeResponse }; // got an answer

// Dev preview: ?mock=... or ?long shows canned analysis instead of calling the backend.
const USE_MOCK = /[?&](mock|long)\b/.test(window.location.search);

export function Replayer({ hand, initialIndex }: { hand: Hand; initialIndex: number }) {
  // The controls move through steps (actions + a pause at the end of each street).
  const steps = useMemo(() => replaySteps(hand), [hand]);
  const stepOf = (actionIndex: number) => steps.findIndex((s) => s.index === actionIndex && !s.closing);
  const last = steps.length - 1;
  const [step, setStep] = useState(() => stepOf(initialIndex));
  const [playing, setPlaying] = useState(false);

  // Which action we're before, and what the table looks like.
  const { index, closing } = steps[step];
  const state = useMemo(() => replayAt(hand, index, closing), [hand, index, closing]);

  // Street buttons jump to the first action of that street (as a step number).
  const streetStarts = useMemo(
    () =>
      Object.fromEntries(
        STREETS.map((s) => {
          const i = streetStartIndex(hand, s);
          return [s, i === null ? null : steps.findIndex((x) => x.index === i && !x.closing)];
        }),
      ) as Record<Street, number | null>,
    [hand, steps],
  );

  // Any manual navigation stops autoplay.
  const seek = (i: number) => {
    setPlaying(false);
    setStep(Math.max(0, Math.min(i, last)));
  };

  // Autoplay: advance one action per tick, stop at the end.
  useEffect(() => {
    if (!playing) return;
    if (step >= last) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((i) => i + 1), PLAY_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [playing, step, last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLSelectElement) return;
      const stop = () => setPlaying(false);
      if (e.key === " ") setPlaying((p) => !p);
      else if (e.key === "ArrowRight") (stop(), setStep((i) => Math.min(i + 1, last)));
      else if (e.key === "ArrowLeft") (stop(), setStep((i) => Math.max(i - 1, 0)));
      else if (e.key === "Home") (stop(), setStep(0));
      else if (e.key === "End") (stop(), setStep(last));
      else if (e.key >= "1" && e.key <= "4") {
        const start = streetStarts[STREETS[Number(e.key) - 1]];
        if (start !== null) (stop(), setStep(start));
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last, streetStarts]);

  // Analysis. Usually already known (sample hand, or pre-run when the hand was saved);
  // if not, it's fetched here. Opening a hand also starts any decisions still missing.
  const [analysis, setAnalysis] = useState<AnalysisState>({ kind: "none" });
  const [retry, setRetry] = useState(0); // bumping this re-runs the effect below

  useEffect(() => {
    if (!USE_MOCK) analyzeWholeHand(hand);
  }, [hand]);

  // Runs every time the user lands on a new action.
  useEffect(() => {
    // Not hero's turn: nothing to show.
    if (!state.isDecisionNode) return setAnalysis({ kind: "none" });
    // Dev preview mode: use canned text.
    if (USE_MOCK) return setAnalysis({ kind: "ready", data: mockFromUrl() });

    // `live` goes false when the user moves on, so a late answer doesn't overwrite the panel.
    let live = true;
    const known = knownAnswer(hand, index);
    if (known) return setAnalysis({ kind: "ready", data: known });

    setAnalysis({ kind: "loading" });
    getAnalysis(hand, index)
      .then((data) => {
        if (live && data.action_index === index) setAnalysis({ kind: "ready", data });
      })
      .catch((e: Error) => {
        if (!live) return;
        if (e instanceof LockedError) setAnalysis({ kind: "locked" });
        else setAnalysis({ kind: "error", message: e.message });
      });
    return () => {
      live = false;
    };
  }, [hand, index, state.isDecisionNode, retry]);

  // Hero's whole stack for this street: chips behind plus what is already in this street.
  const heroSeat = state.seats.find((seat) => seat.position === hand.hero)!;
  const heroAllInTotal = heroSeat.stack + heroSeat.committedThisStreet;

  return (
    <BigBlindProvider value={hand.game.bb}>
    <div className="flex gap-5">
      <main className="w-3/5 rounded-2xl border border-line bg-panel p-5 space-y-5">
        <div className="text-sm font-semibold text-ink-dim">{hand.name}</div>
        <Table hand={hand} state={state} />
        <Controls
          index={step}
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
        <AnalysisPanel state={analysis} onRetry={() => setRetry((n) => n + 1)} allInTotal={heroAllInTotal} />
      </aside>
    </div>
    </BigBlindProvider>
  );
}
