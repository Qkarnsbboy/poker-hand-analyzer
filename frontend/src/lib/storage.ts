// Every save and load of hands goes through this file.
//
//   Guest:     hands live in this browser (localStorage).
//   Logged in: hands live in the database, through the backend (/api/hands).
//
// Saved analysis is handled in analysis.ts (the backend stores it for logged-in users).

import { SAMPLE_HANDS } from "../data/sample-hands";
import { api } from "./api";
import { getAccessToken } from "./auth";
import type { Hand } from "./hand";

// A hand plus its star. The star is kept outside the hand, so the hand stays in the
// data-model.json shape.
export interface SavedHand {
  hand: Hand;
  favorite: boolean;
  created_at: string | null; // when it was first saved (ISO date); null if unknown
}

export function newHandId(): string {
  return "hand-" + Date.now();
}

// Browser hands have no saved date, but new ids hold the time they were made
// ("hand-1763750000000"). Sample hands ("hand-001") have no date.
function dateFromId(id: string): string | null {
  const millis = Number(id.replace("hand-", ""));
  if (!Number.isFinite(millis) || millis < 1_000_000_000_000) return null;
  return new Date(millis).toISOString();
}

// ----- What the app calls -----

export async function listHands(): Promise<SavedHand[]> {
  if (await getAccessToken()) {
    const data = await api<{ hands: SavedHand[] }>("/hands");
    return data.hands;
  }
  const favorites = browserFavorites();
  const result: SavedHand[] = [];
  for (const hand of browserHands()) {
    result.push({ hand, favorite: favorites.has(hand.id), created_at: dateFromId(hand.id) });
  }
  return result;
}

// Create, or replace an edited hand. Throws if it could not be saved.
export async function saveHand(hand: Hand): Promise<void> {
  if (await getAccessToken()) {
    await api(`/hands/${encodeURIComponent(hand.id)}`, { method: "PUT", body: hand });
    return;
  }
  if (!saveBrowserHand(hand)) throw new Error("This browser refused to store the hand.");
}

export async function deleteHand(id: string): Promise<void> {
  if (await getAccessToken()) {
    await api(`/hands/${encodeURIComponent(id)}`, { method: "DELETE" });
    return;
  }
  writeBrowserHands(browserHands().filter((h) => h.id !== id));
}

export async function setFavorite(id: string, favorite: boolean): Promise<void> {
  if (await getAccessToken()) {
    await api(`/hands/${encodeURIComponent(id)}/favorite`, { method: "PUT", body: { favorite } });
    return;
  }
  const favorites = browserFavorites();
  if (favorite) favorites.add(id);
  else favorites.delete(id);
  writeBrowserFavorites(favorites);
}

// ----- Moving a guest's hands into their new account -----

// Hands the guest made in this browser (not the sample hands).
export function guestHandsToImport(): Hand[] {
  const sampleIds = new Set(SAMPLE_HANDS.map((h) => h.id));
  return browserHands().filter((h) => !sampleIds.has(h.id));
}

// After an import: remove those hands from this browser.
export function forgetBrowserHands(ids: string[]): void {
  const remove = new Set(ids);
  writeBrowserHands(browserHands().filter((h) => !remove.has(h.id)));
}

// ----- Browser storage (guests) -----

const HANDS_KEY = "poker.hands";
const SEEDED_KEY = "poker.seeded";
const FAVORITES_KEY = "poker.favorites";

function readBrowserHands(): Hand[] {
  try {
    const raw = localStorage.getItem(HANDS_KEY);
    return raw ? (JSON.parse(raw) as Hand[]) : [];
  } catch {
    return [];
  }
}

function writeBrowserHands(hands: Hand[]): boolean {
  try {
    localStorage.setItem(HANDS_KEY, JSON.stringify(hands));
    return true;
  } catch {
    return false;
  }
}

// Adds each sample hand once. After that it's an ordinary hand: editable, deletable.
function addSampleHandsOnce(): void {
  try {
    const raw = localStorage.getItem(SEEDED_KEY);
    const seeded = new Set<string>(raw && raw.startsWith("[") ? JSON.parse(raw) : []);
    const fresh = SAMPLE_HANDS.filter((h) => !seeded.has(h.id));
    if (fresh.length === 0) return;
    const freshIds = new Set(fresh.map((h) => h.id));
    const kept = readBrowserHands().filter((h) => !freshIds.has(h.id));
    if (writeBrowserHands([...kept, ...fresh])) {
      localStorage.setItem(SEEDED_KEY, JSON.stringify(SAMPLE_HANDS.map((h) => h.id)));
    }
  } catch {
    // storage unavailable
  }
}

function browserHands(): Hand[] {
  addSampleHandsOnce();
  return readBrowserHands();
}

// New hands go first; an edited hand keeps its place.
function saveBrowserHand(hand: Hand): boolean {
  const hands = browserHands();
  const index = hands.findIndex((h) => h.id === hand.id);
  if (index < 0) return writeBrowserHands([hand, ...hands]);
  hands[index] = hand;
  return writeBrowserHands(hands);
}

function browserFavorites(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function writeBrowserFavorites(favorites: Set<string>): void {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
  } catch {
    // storage unavailable
  }
}
