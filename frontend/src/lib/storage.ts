import type { Hand } from "./hand";

// Saved hands live in this browser. All persistence goes through this file,
// so it can move to a database later without touching the UI.

const KEY = "poker.hands";

export function loadHands(): Hand[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Hand[]) : [];
  } catch {
    return [];
  }
}

function write(hands: Hand[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(hands));
    return true;
  } catch {
    return false;
  }
}

export function newHandId(): string {
  return "hand-" + Date.now();
}

// Newest first. Returns false if the browser refused to store it.
export function saveHand(hand: Hand): boolean {
  return write([hand, ...loadHands().filter((h) => h.id !== hand.id)]);
}

export function deleteHand(id: string): void {
  write(loadHands().filter((h) => h.id !== id));
}
