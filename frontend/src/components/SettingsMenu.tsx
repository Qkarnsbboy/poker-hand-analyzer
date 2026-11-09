import { useEffect, useRef, useState } from "react";
import type { Unit } from "../lib/money";
import { THEMES, type ThemeId } from "../lib/themes";

const UNITS: { id: Unit; label: string }[] = [
  { id: "usd", label: "$" },
  { id: "bb", label: "BB" },
];

interface Props {
  theme: ThemeId;
  onTheme: (t: ThemeId) => void;
  unit: Unit;
  onUnit: (u: Unit) => void;
}

export function SettingsMenu({ theme, onTheme, unit, onUnit }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Settings"
        aria-expanded={open}
        className={"h-full rounded-lg border px-2 hover:bg-raised-hover " + (open ? "border-accent text-accent" : "border-line-strong")}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.9l.1-.1a1.7 1.7 0 0 0-1.2-2.8H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.9-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 w-56 rounded-xl border border-line-strong bg-surface p-3 shadow-xl space-y-3">
          <label className="block">
            <span className="block text-xs font-semibold text-ink-dim mb-1">Theme</span>
            <select
              className="w-full rounded-lg border border-line-strong bg-raised px-2 py-1 text-sm"
              value={theme}
              onChange={(e) => onTheme(e.target.value as ThemeId)}
              aria-label="Theme"
            >
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </label>
          <div>
            <span className="block text-xs font-semibold text-ink-dim mb-1">Show amounts in</span>
            <div className="grid grid-cols-2 rounded-lg border border-line-strong overflow-hidden" role="group" aria-label="Show amounts in">
              {UNITS.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onUnit(u.id)}
                  aria-pressed={unit === u.id}
                  className={"py-1 text-sm font-semibold " + (unit === u.id ? "bg-raised text-accent" : "text-ink-dim hover:bg-raised-hover")}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
