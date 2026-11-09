import { useEffect, useState } from "react";
import { HandBuilder } from "./components/HandBuilder";
import { HandsList } from "./components/HandsList";
import { Replayer } from "./components/Replayer";
import { defaultHand, DEFAULT_INDEX } from "./data/default-hand";
import type { Hand } from "./lib/hand";
import { loadUnit, saveUnit, UnitProvider, type Unit } from "./lib/money";
import { applyTheme, loadTheme, THEMES, type ThemeId } from "./lib/themes";

const headerBtn = "rounded-lg border border-line-strong px-3 py-1 text-sm hover:bg-raised-hover";
const headerBtnActive = "rounded-lg border border-accent text-accent px-3 py-1 text-sm";

type View = "replayer" | "builder" | "hands";

const PAGE_TITLES: Record<View, string> = { replayer: "Replay", builder: "New Hand", hands: "Saved Hands" };
const UNITS: { id: Unit; label: string }[] = [
  { id: "usd", label: "$" },
  { id: "bb", label: "BB" },
];

export default function App() {
  const [theme, setTheme] = useState<ThemeId>(loadTheme);
  useEffect(() => applyTheme(theme), [theme]);

  const [unit, setUnit] = useState<Unit>(loadUnit);
  useEffect(() => saveUnit(unit), [unit]);

  const [view, setView] = useState<View>("replayer");
  const [hand, setHand] = useState<Hand>(defaultHand);
  const [startIndex, setStartIndex] = useState(DEFAULT_INDEX);
  // Bumped so "New Hand" always starts a blank form.
  const [builderKey, setBuilderKey] = useState(0);

  const openHand = (h: Hand) => {
    setHand(h);
    setStartIndex(0);
    setView("replayer");
  };

  return (
    <UnitProvider value={unit}>
    <div className="min-h-full bg-page text-ink p-6">
      <div className="max-w-6xl mx-auto rounded-3xl border border-line bg-surface p-5">
        <header className="flex justify-between items-center mb-5">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold">Poker Hand Analyzer</h1>
            <span className="text-xl text-ink-faint">/</span>
            <h2 className="text-xl font-bold text-accent">{PAGE_TITLES[view]}</h2>
          </div>
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
            <div className="flex rounded-lg border border-line-strong overflow-hidden" role="group" aria-label="Show amounts in">
              {UNITS.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setUnit(u.id)}
                  aria-pressed={unit === u.id}
                  className={"px-3 py-1 text-sm font-semibold " + (unit === u.id ? "bg-raised text-accent" : "text-ink-dim hover:bg-raised-hover")}
                >
                  {u.label}
                </button>
              ))}
            </div>
            <button
              className={view === "builder" ? headerBtnActive : headerBtn}
              onClick={() => {
                setBuilderKey((k) => k + 1);
                setView("builder");
              }}
            >
              New Hand
            </button>
            <button className={view === "hands" ? headerBtnActive : headerBtn} onClick={() => setView("hands")}>
              View Hands
            </button>
          </div>
        </header>
        {view === "replayer" && <Replayer key={hand.id} hand={hand} initialIndex={startIndex} />}
        {view === "builder" && <HandBuilder key={builderKey} onAnalyze={openHand} />}
        {view === "hands" && <HandsList onOpen={openHand} />}
      </div>
    </div>
    </UnitProvider>
  );
}
