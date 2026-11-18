// Mirrors docs/data-model.json. Store decisions only; everything else is derived in replay.ts.

export type Card = string; // rank + lowercase suit, e.g. "As", "Td"

export type Street = "preflop" | "flop" | "turn" | "river";

export const STREETS: Street[] = ["preflop", "flop", "turn", "river"];

export type Position = "SB" | "BB" | "UTG" | "HJ" | "CO" | "BTN";

export interface Game {
  variant: "nlhe";
  format: "cash";
  sb: number;
  bb: number;
  ante: number;
}

export const PLAYER_LABELS = ["fish", "station", "nit", "tag", "lag", "maniac"] as const;
export type PlayerLabel = (typeof PLAYER_LABELS)[number];

export const PLAYER_LABEL_NAMES: Record<PlayerLabel, string> = {
  fish: "Fish",
  station: "Station",
  nit: "Nit",
  tag: "TAG",
  lag: "LAG",
  maniac: "Maniac",
};

export interface Player {
  position: Position;
  stack: number; // starting stack, never changes
  cards: [Card, Card] | null; // null = unknown
  label?: PlayerLabel | null; // villain's player type; null = unknown, absent on hero
}

export interface Board {
  flop: [Card, Card, Card] | null;
  turn: Card | null;
  river: Card | null;
}

// Amounts are the player's total commitment on that street, not increments.
export type Action =
  | { street: Street; position: Position; action: "fold" | "check" }
  | { street: Street; position: Position; action: "call" | "bet" | "raise"; amount: number };

export interface Hand {
  id: string;
  name: string;
  game: Game;
  hero: Position;
  players: Player[];
  board: Board;
  actions: Action[];
  notes: string;
}
