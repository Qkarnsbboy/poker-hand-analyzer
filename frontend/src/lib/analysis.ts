// Claude's analysis of a hero decision: the shape (mirrors POST /analyze in
// docs/api-contract.md) and where each answer comes from.
import { SAMPLE_HANDS } from "../data/sample-hands";
import SAMPLE_ANALYSIS from "../data/sample-analysis.json";
import { api } from "./api";
import { getAccessToken } from "./auth";
import type { Hand } from "./hand";

export type RecommendedAction = "fold" | "check" | "call" | "bet" | "raise";

export interface AnalyzeResponse {
  action_index: number;
  recommendation: {
    action: RecommendedAction;
    sizing: number | null;
    confidence: "high" | "medium" | "low";
  };
  theory: Theory;
  exploitative: Exploitative;
}

// Theory, in four buckets. Each bucket is a list of short bullets.
export interface Theory {
  hero_range: string[]; // Hero's range, and where Hero's hand fits in it
  villain_range: string[]; // Villain's possible hands, given the action
  board_texture: string[]; // how the board changes things
  bet_sizing: string[]; // pot odds, SPR, sizing
}

// Exploitative, in four buckets. Each bucket is a list of short bullets.
export interface Exploitative {
  theory_baseline: string[]; // the default play, simply
  player_type: string[]; // how this type deviates from theory
  reads: string[]; // what the notes suggest; empty when there are no notes
  adjustment: string[]; // the recommended play, given everything
}

// ----- Where an answer comes from -----
//
//   1. Sample hand, not edited  -> pre-made answer (data/sample-analysis.json). Free, for everyone.
//   2. Already fetched          -> kept in memory for this visit.
//   3. Guest, own hand          -> locked: "Sign in to get analysis".
//   4. Logged in                -> the backend (/analyze). It returns a saved answer
//                                  if it has one (free), or asks Claude and saves it.

// Thrown for a guest's own hand: analysis needs an account.
export class LockedError extends Error {
  constructor() {
    super("Sign in to get analysis.");
  }
}

// Same content, same text: object keys in a fixed (sorted) order. The name is left out,
// because renaming a hand does not change its analysis.
export function handFingerprint(hand: Hand): string {
  const { name: _name, ...content } = hand;
  return stableJson(content);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort();
    const parts: string[] = [];
    for (const key of keys) {
      const item = (value as Record<string, unknown>)[key];
      if (item === undefined) continue;
      parts.push(JSON.stringify(key) + ":" + stableJson(item));
    }
    return "{" + parts.join(",") + "}";
  }
  return JSON.stringify(value);
}

// Every action index where it's hero's turn.
export function heroDecisions(hand: Hand): number[] {
  const indexes: number[] = [];
  hand.actions.forEach((action, index) => {
    if (action.position === hand.hero) indexes.push(index);
  });
  return indexes;
}

// 1. Pre-made answer, if this is an unedited sample hand.
function sampleAnswer(hand: Hand, index: number): AnalyzeResponse | null {
  const sample = SAMPLE_HANDS.find((s) => s.id === hand.id);
  if (!sample || handFingerprint(sample) !== handFingerprint(hand)) return null;
  const answers = (SAMPLE_ANALYSIS as Record<string, Record<string, AnalyzeResponse>>)[hand.id];
  return answers?.[String(index)] ?? null;
}

// 2. Answers fetched during this visit. Key: hand id | version | action index.
const memory = new Map<string, AnalyzeResponse>();
const inFlight = new Map<string, Promise<AnalyzeResponse>>(); // requests still running

function memoryKey(hand: Hand, index: number): string {
  return hand.id + "|" + handFingerprint(hand) + "|" + index;
}

// An answer we already have, without asking anyone. Null if we need to fetch it.
export function knownAnswer(hand: Hand, index: number): AnalyzeResponse | null {
  return sampleAnswer(hand, index) ?? memory.get(memoryKey(hand, index)) ?? null;
}

// One decision's answer. Throws LockedError for a guest's own hand.
export async function getAnalysis(hand: Hand, index: number): Promise<AnalyzeResponse> {
  const known = knownAnswer(hand, index);
  if (known) return known;
  if (!(await getAccessToken())) throw new LockedError();

  // Reuse a request that is already running for this spot.
  const key = memoryKey(hand, index);
  let request = inFlight.get(key);
  if (!request) {
    request = fetchAnalysis(hand, index)
      .then((answer) => {
        memory.set(key, answer);
        return answer;
      })
      .finally(() => inFlight.delete(key)); // done or failed: a retry can start fresh
    inFlight.set(key, request);
  }
  return request;
}

// 4. Ask the backend about one decision.
async function fetchAnalysis(hand: Hand, actionIndex: number): Promise<AnalyzeResponse> {
  const answer = await api<AnalyzeResponse>("/analyze", {
    method: "POST",
    body: { hand, action_index: actionIndex },
  });
  // Debug: see exactly what the backend returned (DevTools -> Console).
  console.log(`[analyze] action ${actionIndex}`, answer);
  return answer;
}

// Logged in: load every saved answer for this hand in one request.
async function loadSavedAnswers(hand: Hand): Promise<void> {
  try {
    const data = await api<{ results: Record<string, AnalyzeResponse> }>(
      `/hands/${encodeURIComponent(hand.id)}/analysis`,
    );
    for (const [index, answer] of Object.entries(data.results)) {
      memory.set(memoryKey(hand, Number(index)), answer);
    }
  } catch {
    // Not saved yet (404) or offline: the per-decision requests below cover it.
  }
}

// ----- Pre-running a whole hand -----
// Logged in only. Loads saved answers, then asks for every decision still missing,
// all at once, so the replayer shows them instantly. Guests: does nothing.
export async function analyzeWholeHand(hand: Hand): Promise<void> {
  if (!(await getAccessToken())) return;
  await loadSavedAnswers(hand);
  for (const index of heroDecisions(hand)) {
    if (knownAnswer(hand, index)) continue;
    getAnalysis(hand, index).catch(() => {}); // failures show when you reach that spot
  }
}
