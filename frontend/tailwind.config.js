/** @type {import('tailwindcss').Config} */
// Colors are CSS variables (RGB triplets) set per theme in src/index.css.
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: v("page"),
        surface: v("surface"),
        panel: v("panel"),
        raised: v("raised"),
        "raised-hover": v("raised-hover"),
        line: v("line"),
        "line-strong": v("line-strong"),
        ink: v("ink"),
        "ink-dim": v("ink-dim"),
        "ink-faint": v("ink-faint"),
        accent: v("accent"),
        rail: v("rail"),
        plate: v("plate"),
        "plate-ink": v("plate-ink"),
      },
    },
  },
  plugins: [],
};
