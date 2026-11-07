// Keep in sync with the [data-theme] blocks in src/index.css.
export const THEMES = [
  { id: "midnight", label: "Midnight" },
  { id: "charcoal", label: "Charcoal (PT4)" },
  { id: "slate", label: "Slate" },
  { id: "navy", label: "Navy" },
  { id: "light", label: "Light" },
  { id: "casino", label: "Casino" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const KEY = "theme";

export function loadTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(KEY);
    if (THEMES.some((t) => t.id === saved)) return saved as ThemeId;
  } catch {
    // storage unavailable
  }
  return "midnight";
}

export function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // storage unavailable
  }
}
