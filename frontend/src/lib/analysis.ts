// Mirrors POST /analyze in docs/api-contract.md.
import type { Hand } from "./hand";
import { handFingerprint, loadAnalysis, saveAnalysis } from "./storage";

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

// Ask the backend to analyze one hero decision.
// Throws on any failure; the caller shows "Analysis unavailable".
// `signal` (optional) cancels the request in the browser.
export async function fetchAnalysis(hand: Hand, actionIndex: number, signal?: AbortSignal): Promise<AnalyzeResponse> {
  // Send the whole hand plus which action we're at.
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hand, action_index: actionIndex }),
    signal,
  });
  // Not a 2xx: pull the message out of our error shape if we can.
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    console.warn(`[analyze] action ${actionIndex} failed`, res.status, body);
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  const data: AnalyzeResponse = await res.json();
  // Debug: see exactly what the backend returned (DevTools -> Console).
  console.log(`[analyze] action ${actionIndex}`, data);
  return data;
}

// ----- Pre-running a whole hand -----
// When a hand is saved (or first opened), every hero decision is sent to Claude at once,
// in parallel. Answers are saved, so the replayer shows them instantly.

// Requests still waiting on Claude, so nobody starts a second one for the same spot.
const inFlight = new Map<string, Promise<AnalyzeResponse>>();

// Every action index where it's hero's turn.
export function heroDecisions(hand: Hand): number[] {
  return hand.actions.flatMap((a, i) => (a.position === hand.hero ? [i] : []));
}

// One decision: saved answer, else the request already running, else a new request.
export function getAnalysis(hand: Hand, index: number): Promise<AnalyzeResponse> {
  const saved = loadAnalysis(hand, index);
  if (saved) return Promise.resolve(saved);

  const key = hand.id + "|" + handFingerprint(hand) + "|" + index;
  let request = inFlight.get(key);
  if (!request) {
    request = fetchAnalysis(hand, index)
      .then((data) => {
        saveAnalysis(hand, index, data);
        return data;
      })
      .finally(() => inFlight.delete(key)); // done or failed: a retry can start fresh
    inFlight.set(key, request);
  }
  return request;
}

// Every decision in the hand. Fire and forget; failures show up when you reach that spot.
export function analyzeWholeHand(hand: Hand): void {
  for (const i of heroDecisions(hand)) getAnalysis(hand, i).catch(() => {});
}
