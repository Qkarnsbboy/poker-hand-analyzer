import type { ReactNode } from "react";
import type { Street } from "../lib/hand";

interface Props {
  index: number;
  last: number;
  street: Street;
  streetStarts: Record<Street, number | null>;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (index: number) => void;
}

// Beveled buttons in the style of the PokerTracker 4 replayer.
const base =
  "flex items-center justify-center rounded-md border bg-raised " +
  "bg-gradient-to-b from-white/15 to-black/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.3)] " +
  "hover:bg-raised-hover active:from-black/15 active:to-white/5 " +
  "disabled:opacity-35 disabled:hover:bg-raised";
const btn = `${base} border-line-strong text-ink-dim`;
// Current street: pressed in, like a held-down button.
const btnActive =
  "flex items-center justify-center rounded-md border border-accent bg-page text-accent " +
  "shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] cursor-default";

const Icon = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden>
    {children}
  </svg>
);

const ICONS = {
  play: <path d="M7 4.5v15l12.5-7.5z" />,
  pause: <path d="M6 4.5h4.5v15H6zM13.5 4.5H18v15h-4.5z" />,
  start: <path d="M4 4.5h2.5v15H4zM14 4.5v15L6.5 12zM21 4.5v15L13.5 12z" />,
  back: <path d="M12 4.5v15L3 12zM21 4.5v15L12 12z" />,
  forward: <path d="M3 4.5v15L12 12zM12 4.5v15L21 12z" />,
  end: <path d="M3 4.5v15L10.5 12zM10 4.5v15l7.5-7.5zM17.5 4.5H20v15h-2.5z" />,
};

const JUMPS: { street: Street; label: string; key: string }[] = [
  { street: "preflop", label: "Preflop", key: "1" },
  { street: "flop", label: "Flop", key: "2" },
  { street: "turn", label: "Turn", key: "3" },
  { street: "river", label: "River", key: "4" },
];

export function Controls({ index, last, street, streetStarts, playing, onPlay, onPause, onSeek }: Props) {
  const atStart = index === 0;
  const atEnd = index === last;
  const transport: { icon: keyof typeof ICONS; title: string; onClick: () => void; disabled: boolean }[] = [
    { icon: "play", title: "Play (Space)", onClick: onPlay, disabled: playing || atEnd },
    { icon: "pause", title: "Pause (Space)", onClick: onPause, disabled: !playing },
    { icon: "start", title: "Restart (Home)", onClick: () => onSeek(0), disabled: atStart },
    { icon: "back", title: "Back (←)", onClick: () => onSeek(index - 1), disabled: atStart },
    { icon: "forward", title: "Forward (→)", onClick: () => onSeek(index + 1), disabled: atEnd },
    { icon: "end", title: "End (End)", onClick: () => onSeek(last), disabled: atEnd },
  ];

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-6 gap-1.5">
        {transport.map((b) => (
          <button key={b.icon} className={`${btn} h-9`} onClick={b.onClick} disabled={b.disabled} title={b.title} aria-label={b.title}>
            <Icon>{ICONS[b.icon]}</Icon>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {JUMPS.map((j) => {
          const start = streetStarts[j.street];
          return (
            <button
              key={j.street}
              className={`${j.street === street ? btnActive : btn} h-9 text-base font-bold uppercase tracking-wide`}
              onClick={() => start !== null && onSeek(start)}
              disabled={start === null}
              aria-current={j.street === street ? "step" : undefined}
              title={`${j.label} (${j.key})`}
            >
              {j.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
