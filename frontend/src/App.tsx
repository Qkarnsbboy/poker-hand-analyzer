import { useEffect, useState } from "react";
import { HandBuilder } from "./components/HandBuilder";
import { HandsList } from "./components/HandsList";
import { Replayer } from "./components/Replayer";
import { SettingsMenu } from "./components/SettingsMenu";
import { defaultHand, DEFAULT_INDEX } from "./data/default-hand";
import { analyzeWholeHand } from "./lib/analysis";
import type { Hand } from "./lib/hand";
import { loadHands } from "./lib/storage";
import { loadUnit, saveUnit, UnitProvider, type Unit } from "./lib/money";
import { applyTheme, loadTheme, type ThemeId } from "./lib/themes";

const headerBtn = "rounded-lg bg-ink text-page px-3 py-1 text-sm font-semibold hover:opacity-85";
const headerBtnActive = "rounded-lg bg-accent text-page px-3 py-1 text-sm font-semibold";

type View = "replayer" | "builder" | "hands";

const PAGE_TITLES: Record<View, string> = { replayer: "Analyze", builder: "New Hand", hands: "Saved Hands" };

export default function App() {
  const [theme, setTheme] = useState<ThemeId>(loadTheme);
  useEffect(() => applyTheme(theme), [theme]);

  // Pre-fill analysis for every saved hand in the background, so no hand
  // makes you wait when you open it. Spots that are already saved cost nothing.
  useEffect(() => {
    const previewMode = /[?&](mock|long)\b/.test(window.location.search);
    if (previewMode) return; // canned answers only, no Claude calls
    for (const savedHand of loadHands()) {
      analyzeWholeHand(savedHand);
    }
  }, []);

  const [unit, setUnit] = useState<Unit>(loadUnit);
  useEffect(() => saveUnit(unit), [unit]);

  const [view, setView] = useState<View>("replayer");
  const [hand, setHand] = useState<Hand>(defaultHand);
  const [startIndex, setStartIndex] = useState(DEFAULT_INDEX);
  // Bumped so the builder and replayer start fresh each time they're opened.
  const [builderKey, setBuilderKey] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  const [editing, setEditing] = useState<Hand | null>(null);

  const openHand = (h: Hand) => {
    setHand(h);
    setStartIndex(0);
    setOpenCount((n) => n + 1);
    setView("replayer");
  };

  const startBuilder = (h: Hand | null) => {
    setEditing(h);
    setBuilderKey((k) => k + 1);
    setView("builder");
  };

  return (
    <UnitProvider value={unit}>
    <div className="min-h-full bg-page text-ink p-6">
      <div className="max-w-6xl mx-auto rounded-3xl border border-line bg-surface p-5">
        <header className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">
              <button type="button" className="flex items-center gap-2 hover:opacity-80" onClick={() => setView("replayer")}>
                <img src="/logo.png" alt="" className="w-9 h-9" />
                Poker Hand Analyzer
              </button>
            </h1>
            <span className="text-xl text-ink-faint">/</span>
            <h2 className="text-xl font-bold text-accent">{view === "builder" && editing ? "Edit Hand" : PAGE_TITLES[view]}</h2>
          </div>
          <div className="flex gap-2">
            <button className={view === "replayer" ? headerBtnActive : headerBtn} onClick={() => setView("replayer")}>
              Analyze
            </button>
            <button
              className={view === "builder" ? headerBtnActive : headerBtn}
              onClick={() => startBuilder(null)}
            >
              New Hand
            </button>
            <button className={view === "hands" ? headerBtnActive : headerBtn} onClick={() => setView("hands")}>
              View Hands
            </button>
            <SettingsMenu theme={theme} onTheme={setTheme} unit={unit} onUnit={setUnit} />
          </div>
        </header>
        {view === "replayer" && <Replayer key={hand.id + "-" + openCount} hand={hand} initialIndex={startIndex} />}
        {view === "builder" && <HandBuilder key={builderKey} initial={editing ?? undefined} onAnalyze={openHand} />}
        {view === "hands" && <HandsList onOpen={openHand} onEdit={startBuilder} onNew={() => startBuilder(null)} />}
      </div>
    </div>
    </UnitProvider>
  );
}
