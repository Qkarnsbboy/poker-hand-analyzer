import type { Card } from "../lib/hand";

// Four-color deck with suit-colored faces, as in PokerTracker 4.
const SUITS: Record<string, { symbol: string; bg: string }> = {
  s: { symbol: "♠", bg: "bg-neutral-600" },
  h: { symbol: "♥", bg: "bg-red-600" },
  d: { symbol: "♦", bg: "bg-blue-600" },
  c: { symbol: "♣", bg: "bg-green-600" },
};

const SIZES = {
  md: { box: "w-12 h-16", rank: "text-4xl", suit: "text-xs" },
  sm: { box: "w-10 h-14", rank: "text-3xl", suit: "text-[10px]" },
};

type Size = keyof typeof SIZES;

export function PlayingCard({ card, size = "md" }: { card: Card; size?: Size }) {
  const suit = SUITS[card[1]];
  const s = SIZES[size];
  return (
    <div
      className={`${s.box} ${suit.bg} relative rounded-md border border-white/30 shadow-md flex items-center justify-center text-white font-bold select-none`}
    >
      <span className={`absolute top-0.5 right-1 ${s.suit} leading-none`}>{suit.symbol}</span>
      <span className={`${s.rank} leading-none`}>{card[0]}</span>
    </div>
  );
}

export function CardBack({ size = "md" }: { size?: Size }) {
  return (
    <div
      className={`${SIZES[size].box} rounded-md shadow-md border-2 border-white bg-red-800 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,0.15)_4px,rgba(255,255,255,0.15)_8px)]`}
    />
  );
}

export function EmptyCardSlot() {
  return <div className={`${SIZES.md.box} rounded-md border border-dashed border-white/25`} />;
}
