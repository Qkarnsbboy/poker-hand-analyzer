import type { Hand } from "../lib/hand";

// "Aces Cracked" from the wireframe: hero's AA faces a river shove on Ks Jc 3s 4h 2d.
export const defaultHand: Hand = {
  id: "hand-001",
  game: { variant: "nlhe", format: "cash", sb: 2, bb: 5, ante: 0 },
  hero: "BTN",
  players: [
    { position: "BTN", stack: 700, cards: ["As", "Ah"] },
    { position: "BB", stack: 600, cards: ["Ad", "5c"] },
  ],
  board: { flop: ["Ks", "Jc", "3s"], turn: "4h", river: "2d" },
  actions: [
    { street: "preflop", position: "BTN", action: "raise", amount: 15 },
    { street: "preflop", position: "BB", action: "raise", amount: 50 },
    { street: "preflop", position: "BTN", action: "call", amount: 50 },
    { street: "flop", position: "BB", action: "bet", amount: 35 },
    { street: "flop", position: "BTN", action: "call", amount: 35 },
    { street: "turn", position: "BB", action: "check" },
    { street: "turn", position: "BTN", action: "bet", amount: 115 },
    { street: "turn", position: "BB", action: "call", amount: 115 },
    { street: "river", position: "BB", action: "bet", amount: 400 },
    { street: "river", position: "BTN", action: "call", amount: 400 },
  ],
  notes: "Villain is loose, plays lots of draws, and seems to overbluff.",
};

// Opens on hero facing the river shove.
export const DEFAULT_INDEX = 9;
