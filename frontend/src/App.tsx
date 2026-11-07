import { useEffect, useMemo, useState } from "react";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { Controls } from "./components/Controls";
import { Table } from "./components/Table";
import { defaultHand, DEFAULT_INDEX } from "./data/default-hand";
import { mockFromUrl } from "./data/mock-analysis";
import type { Street } from "./lib/hand";
import { STREETS } from "./lib/hand";
import { replayAt, streetStartIndex } from "./lib/replay";
import { applyTheme, loadTheme, THEMES, type ThemeId } from "./lib/themes";

const PLAY_INTERVAL_MS = 1000;

const headerBtn = "rounded-lg border border-line-strong px-3 py-1 text-sm disabled:opacity-40";

export default function App() {
  const hand = defaultHand;
  const last = hand.actions.length;
  const [index, setIndex] = useState(DEFAULT_INDEX);
  const [theme, setTheme] = useState<ThemeId>(loadTheme);
  useEffect(() => applyTheme(theme), [theme]);
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
  const [playing, setPlaying] = useState(false);
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

  return (
    <div className="min-h-full bg-page text-ink p-6">
      <div className="max-w-6xl mx-auto rounded-3xl border border-line bg-surface p-5">
        <header className="flex justify-between items-center mb-5">
          <h1 className="text-xl font-bold">Poker Hand Analyzer</h1>
          <div className="flex gap-2">
            <select
              className="rounded-lg border border-line-strong bg-raised px-2 py-1 text-sm"
              value={theme}
              onChange={(e) => setTheme(e.target.value as ThemeId)}
              aria-label="Theme"
            >
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            {/* Wired up in slice 2 */}
            <button className={headerBtn} disabled title="Coming in slice 2">New Hand</button>
            <button className={headerBtn} disabled title="Not in v1">View Hands</button>
          </div>
        </header>
        <div className="flex gap-5">
          <main className="w-3/5 rounded-2xl border border-line bg-panel p-5 space-y-5">
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
            <AnalysisPanel analysis={state.isDecisionNode ? mockFromUrl() : null} />
          </aside>
        </div>
      </div>
    </div>
  );
}
