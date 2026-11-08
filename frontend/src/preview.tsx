// Standalone design preview at /preview.html. Not part of the app.
import React from "react";
import ReactDOM from "react-dom/client";
import { ActionBox } from "./components/AnalysisPanel";
import type { RecommendedAction } from "./lib/analysis";
import { applyTheme, loadTheme } from "./lib/themes";
import "./index.css";

applyTheme(loadTheme());

const rec = (action: RecommendedAction, sizing: number | null = null) => ({ action, sizing, confidence: "medium" as const });

const CURRENT: { label: string; rec: ReturnType<typeof rec> }[] = [
  { label: "Call", rec: rec("call") },
  { label: "Check", rec: rec("check") },
  { label: "Fold", rec: rec("fold") },
  { label: "Bet", rec: rec("bet", 300) },
  { label: "Raise", rec: rec("raise", 500) },
];

const CHECK_OPTIONS = [
  { label: "Green", cls: "bg-green-600 border-green-400" },
  { label: "Grey (current)", cls: "bg-slate-500 border-slate-300" },
  { label: "Teal", cls: "bg-teal-600 border-teal-400" },
  { label: "Purple", cls: "bg-violet-600 border-violet-400" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-ink-dim">{title}</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">{children}</div>
    </section>
  );
}

function Preview() {
  return (
    <div className="min-h-full bg-page text-ink p-8 space-y-10">
      <h1 className="text-xl font-bold">Recommendation buttons</h1>
      <Section title="All actions (current colors)">
        {CURRENT.map((c) => (
          <div key={c.label} className="space-y-1">
            <div className="text-xs text-ink-faint">{c.label}</div>
            <ActionBox rec={c.rec} />
          </div>
        ))}
      </Section>
      <Section title="Check color options">
        {CHECK_OPTIONS.map((o) => (
          <div key={o.label} className="space-y-1">
            <div className="text-xs text-ink-faint">{o.label}</div>
            <ActionBox rec={rec("check")} colorClass={o.cls} />
          </div>
        ))}
      </Section>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Preview />
  </React.StrictMode>,
);
