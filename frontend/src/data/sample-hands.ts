import type { Hand } from "../lib/hand";
import { defaultHand } from "./default-hand";

// Hero BB flops a set, villain turns a flush, the river pairs the board for a full house.
const riverTopBoat: Hand = {
  id: "hand-002",
  name: "River Top Boat",
  game: { variant: "nlhe", format: "cash", sb: 2, bb: 5, ante: 0 },
  hero: "BB",
  players: [
    { position: "BB", stack: 1000, cards: ["6s", "6d"] },
    { position: "BTN", stack: 1000, cards: ["Qh", "9h"], label: null },
  ],
  board: { flop: ["6h", "5h", "2s"], turn: "Kh", river: "5s" },
  actions: [
    { street: "preflop", position: "BTN", action: "raise", amount: 20 },
    { street: "preflop", position: "BB", action: "call", amount: 20 },
    { street: "flop", position: "BB", action: "check" },
    { street: "flop", position: "BTN", action: "bet", amount: 40 },
    { street: "flop", position: "BB", action: "raise", amount: 120 },
    { street: "flop", position: "BTN", action: "call", amount: 120 },
    { street: "turn", position: "BB", action: "bet", amount: 100 },
    { street: "turn", position: "BTN", action: "call", amount: 100 },
    { street: "river", position: "BB", action: "bet", amount: 760 },
    { street: "river", position: "BTN", action: "call", amount: 760 },
  ],
  notes:
    "Early hand of the night in a new game. Villain looked European/Russian, few reads on him. " +
    "He tanked on my river jam, asked if we'd played before, I said we hadn't, then he called.",
};

// Hero BB with a combo draw: check-raises the flop, leads the turn, faces a shove.
const comboDraw: Hand = {
  id: "hand-003",
  name: "Combo Draw vs Turn Shove",
  game: { variant: "nlhe", format: "cash", sb: 1, bb: 2, ante: 0 },
  hero: "BB",
  players: [
    { position: "BB", stack: 200, cards: ["9h", "8h"] },
    { position: "BTN", stack: 200, cards: null, label: "tag" },
  ],
  board: { flop: ["Th", "7h", "2c"], turn: "Ks", river: "3d" },
  actions: [
    { street: "preflop", position: "BTN", action: "raise", amount: 6 },
    { street: "preflop", position: "BB", action: "call", amount: 6 },
    { street: "flop", position: "BB", action: "check" },
    { street: "flop", position: "BTN", action: "bet", amount: 8 },
    { street: "flop", position: "BB", action: "raise", amount: 30 },
    { street: "flop", position: "BTN", action: "call", amount: 30 },
    { street: "turn", position: "BB", action: "bet", amount: 45 },
    { street: "turn", position: "BTN", action: "raise", amount: 164 },
    { street: "turn", position: "BB", action: "call", amount: 164 },
  ],
  notes: "Villain is a solid reg who rarely bluff-raises the turn.",
};

// Seeded into saved hands on first load, in this order.
export const SAMPLE_HANDS: Hand[] = [defaultHand, riverTopBoat, comboDraw];
