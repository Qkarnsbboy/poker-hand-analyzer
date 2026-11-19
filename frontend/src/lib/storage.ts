import { SAMPLE_HANDS } from "../data/sample-hands";
import type { AnalyzeResponse } from "./analysis";
import type { Hand } from "./hand";

// Saved hands live in this browser. All persistence goes through this file,
// so it can move to a database later without touching the UI.

const KEY = "poker.hands";
const SEEDED_KEY = "poker.seeded";

function read(): Hand[] {
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

// Adds each sample hand once. After that it's an ordinary hand: editable, deletable, gone for good.
function seed(): void {
  try {
    const raw = localStorage.getItem(SEEDED_KEY);
    const seeded = new Set<string>(raw && raw.startsWith("[") ? JSON.parse(raw) : []);
    const fresh = SAMPLE_HANDS.filter((h) => !seeded.has(h.id));
    if (fresh.length === 0) return;
    const saved = read();
    const ids = new Set(fresh.map((h) => h.id));
    if (write([...saved.filter((h) => !ids.has(h.id)), ...fresh])) {
      localStorage.setItem(SEEDED_KEY, JSON.stringify(SAMPLE_HANDS.map((h) => h.id)));
    }
  } catch {
    // storage unavailable
  }
}

export function loadHands(): Hand[] {
  seed();
  return read();
}

export function newHandId(): string {
  return "hand-" + Date.now();
}

// New hands go first; an edited hand keeps its place. Returns false if the browser refused to store it.
export function saveHand(hand: Hand): boolean {
  const hands = loadHands();
  const i = hands.findIndex((h) => h.id === hand.id);
  if (i < 0) return write([hand, ...hands]);
  hands[i] = hand;
  return write(hands);
}

export function deleteHand(id: string): void {
  write(loadHands().filter((h) => h.id !== id));
  deleteAnalysis(id);
}

// Favorites are kept apart from the hands so the hand shape stays as in docs/data-model.json.
const FAVORITES_KEY = "poker.favorites";

export function loadFavorites(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function toggleFavorite(id: string): Set<string> {
  const favs = loadFavorites();
  if (!favs.delete(id)) favs.add(id);
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs]));
  } catch {
    // storage unavailable
  }
  return favs;
}

// ----- Saved analysis -----
// Claude's answers for each hand, kept apart from the hand itself (the hand stores
// decisions only). Each entry remembers a fingerprint of the hand it was made for,
// so editing the hand throws the old answers away.

const ANALYSIS_KEY = "poker.analysis";

interface SavedAnalysis {
  fingerprint: string;
  results: Record<number, AnalyzeResponse>; // action index -> answer
}

function readAnalysis(): Record<string, SavedAnalysis> {
  try {
    return JSON.parse(localStorage.getItem(ANALYSIS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeAnalysis(all: Record<string, SavedAnalysis>): void {
  try {
    localStorage.setItem(ANALYSIS_KEY, JSON.stringify(all));
  } catch {
    // storage full or unavailable: answers just won't persist
  }
}

// Everything that changes the analysis. The name doesn't, so it's left out.
export function handFingerprint(hand: Hand): string {
  const { name: _name, ...rest } = hand;
  return JSON.stringify(rest);
}

// Saved answer for this exact version of the hand, or null.
export function loadAnalysis(hand: Hand, index: number): AnalyzeResponse | null {
  const saved = readAnalysis()[hand.id];
  if (!saved || saved.fingerprint !== handFingerprint(hand)) return null;
  return saved.results[index] ?? null;
}

export function saveAnalysis(hand: Hand, index: number, result: AnalyzeResponse): void {
  const all = readAnalysis();
  const fingerprint = handFingerprint(hand);
  // Different version of the hand: start fresh.
  if (all[hand.id]?.fingerprint !== fingerprint) all[hand.id] = { fingerprint, results: {} };
  all[hand.id].results[index] = result;
  writeAnalysis(all);
}

export function deleteAnalysis(id: string): void {
  const all = readAnalysis();
  delete all[id];
  writeAnalysis(all);
}
