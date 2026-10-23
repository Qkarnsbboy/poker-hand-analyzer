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

export interface Player {
  position: Position;
  stack: number; // starting stack, never changes
  cards: [Card, Card] | null; // null = unknown
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
  game: Game;
  hero: Position;
  players: Player[];
  board: Board;
  actions: Action[];
  notes: string;
}
