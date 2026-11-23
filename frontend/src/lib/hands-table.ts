// The values the hand table shows, sorts and filters by. Kept apart from the
// component so they are easy to test.

import type { Hand } from "./hand";
import { replayAt } from "./replay";
import type { SavedHand } from "./storage";

export interface HandRow {
  saved: SavedHand;
  id: string;
  name: string;
  favorite: boolean;
  stakes: string; // "$2/$5"
  bigBlind: number; // for sorting stakes
  position: string; // hero's seat: "BTN" or "BB"
  pot: number; // final pot
  createdAt: number | null; // milliseconds, for sorting; null = unknown
}

export function toRow(saved: SavedHand): HandRow {
  const hand = saved.hand;
  return {
    saved,
    id: hand.id,
    name: hand.name,
    favorite: saved.favorite,
    stakes: stakesLabel(hand),
    bigBlind: hand.game.bb,
    position: hand.hero,
    pot: replayAt(hand, hand.actions.length).pot,
    createdAt: saved.created_at ? Date.parse(saved.created_at) : null,
  };
}

export function stakesLabel(hand: Hand): string {
  return "$" + hand.game.sb + "/$" + hand.game.bb;
}

// Search box: matches the hand's name or notes, ignoring upper/lower case.
export function matchesSearch(row: HandRow, search: string): boolean {
  const text = search.trim().toLowerCase();
  if (text === "") return true;
  const name = row.name.toLowerCase();
  const notes = row.saved.hand.notes.toLowerCase();
  return name.includes(text) || notes.includes(text);
}

// The stakes that appear in these hands, smallest first, for the Stakes filter.
export function stakesOptions(rows: HandRow[]): string[] {
  const sorted = [...rows].sort((a, b) => a.bigBlind - b.bigBlind);
  const labels: string[] = [];
  for (const row of sorted) {
    if (!labels.includes(row.stakes)) labels.push(row.stakes);
  }
  return labels;
}

// "11/20/2026". A dash when unknown.
export function shortDate(millis: number | null): string {
  if (millis === null) return "—";
  return new Date(millis).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}
