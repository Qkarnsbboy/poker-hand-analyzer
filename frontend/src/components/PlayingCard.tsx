import type { Card } from "../lib/hand";

// Four-color deck, as in PokerTracker 4.
const SUITS: Record<string, { symbol: string; color: string }> = {
  s: { symbol: "♠", color: "text-neutral-900" },
  h: { symbol: "♥", color: "text-red-600" },
  d: { symbol: "♦", color: "text-blue-600" },
  c: { symbol: "♣", color: "text-green-700" },
};

const SIZES = {
  md: "w-11 h-16 text-xl",
  sm: "w-9 h-[3.25rem] text-base",
};

type Size = keyof typeof SIZES;

export function PlayingCard({ card, size = "md" }: { card: Card; size?: Size }) {
  const suit = SUITS[card[1]];
  return (
    <div
      className={`${SIZES[size]} ${suit.color} rounded-md bg-white shadow-md flex flex-col items-center justify-center font-bold leading-none select-none`}
    >
      <span>{card[0]}</span>
      <span>{suit.symbol}</span>
    </div>
  );
}

export function CardBack({ size = "md" }: { size?: Size }) {
  return (
    <div
      className={`${SIZES[size]} rounded-md shadow-md border-2 border-white bg-red-800 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,0.15)_4px,rgba(255,255,255,0.15)_8px)]`}
    />
  );
}

export function EmptyCardSlot() {
  return <div className={`${SIZES.md} rounded-md border border-dashed border-white/25`} />;
}
