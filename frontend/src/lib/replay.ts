import type { Action, Card, Hand, Position, Street } from "./hand";
import { STREETS } from "./hand";

// Index semantics: state at index i is the table *before* actions[i] is taken.
// i ranges 0..actions.length; i === actions.length is the end of the hand.

export interface SeatState {
  position: Position;
  stack: number; // remaining, after all commitments so far
  committedThisStreet: number;
  folded: boolean;
  allIn: boolean;
  lastAction: Action | null; // most recent action on the current street
}

export interface TableState {
  index: number;
  street: Street;
  pot: number; // everything committed so far, including the current street
  board: Card[];
  seats: SeatState[];
  toAct: Position | null; // null at end of hand
  toCall: number; // for toAct
  isDecisionNode: boolean;
  isEnd: boolean;
}

// Heads-up, the button posts the small blind.
function smallBlindPosition(hand: Hand): Position {
  return hand.players.some((p) => p.position === "SB") ? "SB" : "BTN";
}

function boardThrough(hand: Hand, street: Street): Card[] {
  const { flop, turn, river } = hand.board;
  const cards: Card[] = [];
  if (street === "preflop" || !flop) return cards;
  cards.push(...flop);
  if (street === "flop" || !turn) return cards;
  cards.push(turn);
  if (street === "turn" || !river) return cards;
  cards.push(river);
  return cards;
}

// closing = true: show the street that just ended (with its final call/check)
// instead of jumping straight to the next street.
export function replayAt(hand: Hand, index: number, closing = false): TableState {
  const n = hand.actions.length;
  const i = Math.max(0, Math.min(index, n));
  // A closing step at the very end is the pause before showdown, not the showdown itself.
  const isEnd = i === n && !closing;

  const seats: SeatState[] = hand.players.map((p) => ({
    position: p.position,
    stack: p.stack,
    committedThisStreet: 0,
    folded: false,
    allIn: false,
    lastAction: null,
  }));
  const seat = (pos: Position) => {
    const s = seats.find((x) => x.position === pos);
    if (!s) throw new Error(`No player at ${pos}`);
    return s;
  };

  let pot = 0;
  const commit = (s: SeatState, total: number) => {
    const delta = total - s.committedThisStreet;
    s.stack -= delta;
    s.committedThisStreet = total;
    pot += delta;
    if (s.stack <= 0) s.allIn = true;
  };

  // Antes are dead money; blinds count toward the preflop commitment.
  for (const s of seats) {
    s.stack -= hand.game.ante;
    pot += hand.game.ante;
  }
  commit(seat(smallBlindPosition(hand)), hand.game.sb);
  commit(seat("BB"), hand.game.bb);

  let street: Street = "preflop";
  const enterStreet = (next: Street) => {
    if (next === street) return;
    street = next;
    for (const s of seats) {
      s.committedThisStreet = 0;
      s.lastAction = null;
    }
  };

  for (const a of hand.actions.slice(0, i)) {
    enterStreet(a.street);
    const s = seat(a.position);
    if (a.action === "fold") s.folded = true;
    else if ("amount" in a) commit(s, a.amount);
    s.lastAction = a;
  }

  // Show the street the next action is on; at the end (or when closing), stay on the last action's street.
  const next = closing ? undefined : hand.actions[i];
  if (next) enterStreet(next.street);
  const shownStreet = next ? next.street : (hand.actions[i - 1]?.street ?? "preflop");

  const currentBet = Math.max(...seats.map((s) => s.committedThisStreet));
  const toAct = next ? next.position : null;

  return {
    index: i,
    street: shownStreet,
    pot,
    // An all-in hand runs out the board with no actions on the later streets.
    board: boardThrough(hand, isEnd && !seats.some((s) => s.folded) ? "river" : shownStreet),
    seats,
    toAct,
    toCall: toAct ? currentBet - seat(toAct).committedThisStreet : 0,
    isDecisionNode: toAct === hand.hero,
    isEnd,
  };
}

// One replayer step = one view of the table.
// Normally that's "before actions[index]". Between streets, and before showdown, we add
// an extra closing step, so you see the final call/check (and the pot) before the next
// cards come or the hands are shown.
export interface Step {
  index: number;
  closing: boolean;
}

export function replaySteps(hand: Hand): Step[] {
  const a = hand.actions;
  const steps: Step[] = [];
  for (let i = 0; i <= a.length; i++) {
    const newStreet = i > 0 && i < a.length && a[i].street !== a[i - 1].street;
    const beforeShowdown = i > 0 && i === a.length;
    if (newStreet || beforeShowdown) steps.push({ index: i, closing: true });
    steps.push({ index: i, closing: false });
  }
  return steps;
}

// First action index on each street, or null if the hand never reached it.
export function streetStartIndex(hand: Hand, street: Street): number | null {
  const i = hand.actions.findIndex((a) => a.street === street);
  return i === -1 ? null : i;
}

export function streetsInHand(hand: Hand): Street[] {
  return STREETS.filter((s) => streetStartIndex(hand, s) !== null);
}
