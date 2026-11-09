import type { Action, Board, Card, Hand, Player, Position, Street } from "./hand";
import { STREETS } from "./hand";
import { replayAt } from "./replay";

// Hand entry state and rules. Heads-up only: positions are always BTN and BB.

export const SLOT_IDS = [
  "hero0",
  "hero1",
  "board0",
  "board1",
  "board2",
  "board3",
  "board4",
  "villain0",
  "villain1",
] as const;

export type SlotId = (typeof SLOT_IDS)[number];
export type Cards = Record<SlotId, Card | null>;

export const STREET_SLOTS: Record<Exclude<Street, "preflop">, SlotId[]> = {
  flop: ["board0", "board1", "board2"],
  turn: ["board3"],
  river: ["board4"],
};

export const SLOT_LABELS: Record<SlotId, string> = {
  hero0: "Hero card 1",
  hero1: "Hero card 2",
  board0: "Flop card 1",
  board1: "Flop card 2",
  board2: "Flop card 3",
  board3: "Turn card",
  board4: "River card",
  villain0: "Villain card 1",
  villain1: "Villain card 2",
};

export interface Draft {
  name: string;
  // Kept as strings so decimals can be typed; parsed where used.
  sb: string;
  bb: string;
  heroStack: string;
  villainStack: string;
  heroPosition: "BTN" | "BB";
  cards: Cards;
  actions: Action[];
  notes: string;
}

export function newDraft(): Draft {
  return {
    name: "",
    sb: "1",
    bb: "2",
    heroStack: "200",
    villainStack: "200",
    heroPosition: "BTN",
    cards: Object.fromEntries(SLOT_IDS.map((s) => [s, null])) as Cards,
    actions: [],
    notes: "",
  };
}

export interface Turn {
  street: Street;
  position: Position;
  toCall: number;
  currentBet: number;
  raiseKind: "bet" | "raise" | null; // null when no raise is possible
  suggested: number;
  maxAmount: number; // capped so neither player can bet more than the other can match
}

export type DraftStatus =
  | { kind: "setup"; message: string }
  | { kind: "need-hero-cards" }
  | { kind: "need-board"; street: Exclude<Street, "preflop"> }
  | { kind: "act"; turn: Turn }
  | { kind: "complete" };

function pair(a: Card | null, b: Card | null): [Card, Card] | null {
  return a && b ? [a, b] : null;
}

export function draftToHand(d: Draft, id = "draft"): Hand {
  const c = d.cards;
  const villainPosition: Position = d.heroPosition === "BTN" ? "BB" : "BTN";
  const hero: Player = { position: d.heroPosition, stack: Number(d.heroStack), cards: pair(c.hero0, c.hero1) };
  const villain: Player = { position: villainPosition, stack: Number(d.villainStack), cards: pair(c.villain0, c.villain1) };
  const board: Board = {
    flop: c.board0 && c.board1 && c.board2 ? [c.board0, c.board1, c.board2] : null,
    turn: c.board3,
    river: c.board4,
  };
  return {
    id,
    name: d.name.trim() || "Untitled hand",
    game: { variant: "nlhe", format: "cash", sb: Number(d.sb), bb: Number(d.bb), ante: 0 },
    hero: d.heroPosition,
    players: [hero, villain],
    board,
    actions: d.actions,
    notes: d.notes,
  };
}

function setupError(d: Draft): string | null {
  const sb = Number(d.sb);
  const bb = Number(d.bb);
  const stacks = [Number(d.heroStack), Number(d.villainStack)];
  if (!(sb > 0) || !(bb > 0)) return "Enter the blinds.";
  if (sb > bb) return "The small blind can't be bigger than the big blind.";
  if (stacks.some((s) => !(s >= bb))) return "Each stack must be at least one big blind.";
  return null;
}

function streetHasBoard(d: Draft, street: Exclude<Street, "preflop">): boolean {
  return STREET_SLOTS[street].every((s) => d.cards[s]);
}

// A street ends on a call or check, once both players have acted.
function isStreetClosed(onStreet: Action[]): boolean {
  if (onStreet.length < 2) return false;
  const last = onStreet[onStreet.length - 1].action;
  return last === "call" || last === "check";
}

function turnOn(d: Draft, street: Street, lastStreet: Street): Turn {
  const hand = draftToHand(d);
  const table = replayAt(hand, d.actions.length);
  const onStreet = d.actions.filter((a) => a.street === street);
  const firstToAct: Position = street === "preflop" ? "BTN" : "BB";
  const position: Position = onStreet.length
    ? onStreet[onStreet.length - 1].position === "BTN"
      ? "BB"
      : "BTN"
    : firstToAct;

  const committed = (p: Position) => {
    const seat = table.seats.find((s) => s.position === p)!;
    return street === lastStreet ? seat.committedThisStreet : 0;
  };
  const total = (p: Position) => committed(p) + table.seats.find((s) => s.position === p)!.stack;

  const other: Position = position === "BTN" ? "BB" : "BTN";
  const currentBet = Math.max(committed("BTN"), committed("BB"));
  const maxAmount = Math.min(total(position), total(other));
  const raiseKind = maxAmount > currentBet ? (currentBet > 0 ? "raise" : "bet") : null;
  const suggested = Math.min(raiseKind === "raise" ? currentBet * 2 : hand.game.bb, maxAmount);

  return { street, position, toCall: currentBet - committed(position), currentBet, raiseKind, suggested, maxAmount };
}

export function draftStatus(d: Draft): DraftStatus {
  const error = setupError(d);
  if (error) return { kind: "setup", message: error };
  if (!d.cards.hero0 || !d.cards.hero1) return { kind: "need-hero-cards" };

  const lastAction = d.actions[d.actions.length - 1];
  const lastStreet: Street = lastAction?.street ?? "preflop";
  const lastIdx = STREETS.indexOf(lastStreet);

  // A board card can be cleared after later streets have actions.
  for (const s of STREETS.slice(1, lastIdx + 1) as Exclude<Street, "preflop">[]) {
    if (!streetHasBoard(d, s)) return { kind: "need-board", street: s };
  }

  if (d.actions.some((a) => a.action === "fold")) return { kind: "complete" };

  const onStreet = d.actions.filter((a) => a.street === lastStreet);
  if (!isStreetClosed(onStreet)) return { kind: "act", turn: turnOn(d, lastStreet, lastStreet) };

  const table = replayAt(draftToHand(d), d.actions.length);
  const allIn = table.seats.some((s) => s.stack <= 0);
  for (const s of STREETS.slice(lastIdx + 1) as Exclude<Street, "preflop">[]) {
    if (!streetHasBoard(d, s)) return { kind: "need-board", street: s };
    if (!allIn) return { kind: "act", turn: turnOn(d, s, lastStreet) };
  }
  return { kind: "complete" };
}

// Which slot the card picker fills when none is explicitly selected.
export function nextSlot(d: Draft, status: DraftStatus): SlotId | null {
  if (status.kind === "need-hero-cards") return d.cards.hero0 ? "hero1" : "hero0";
  if (status.kind === "need-board") return STREET_SLOTS[status.street].find((s) => !d.cards[s]) ?? null;
  return null;
}

// Returns an error message for an invalid bet or raise amount, or null if it's fine.
export function amountError(turn: Turn, amount: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return "Enter an amount.";
  if (amount <= turn.currentBet) return "A raise must be more than the current bet.";
  if (amount > turn.maxAmount) return "That's more than the effective stack.";
  return null;
}

// Why the hand can't be analyzed yet, or null when it's ready.
export function blockingReason(d: Draft, status: DraftStatus): string | null {
  switch (status.kind) {
    case "setup":
      return status.message;
    case "need-hero-cards":
      return "Pick your hole cards.";
    case "need-board":
      return "Pick the " + status.street + ".";
    case "act":
      return "Finish entering the actions.";
    case "complete":
      if (Boolean(d.cards.villain0) !== Boolean(d.cards.villain1)) return "Add villain's second card, or clear the first.";
      return null;
  }
}
