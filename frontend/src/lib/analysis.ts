// Mirrors POST /analyze in docs/api-contract.md.
import type { Hand } from "./hand";

export type RecommendedAction = "fold" | "check" | "call" | "bet" | "raise";

export interface AnalyzeResponse {
  action_index: number;
  recommendation: {
    action: RecommendedAction;
    sizing: number | null;
    confidence: "high" | "medium" | "low";
  };
  theory: string[];
  exploitative: string[];
  what_would_change_this: string;
}

// Ask the backend to analyze one hero decision.
// Throws on any failure; the caller shows "Analysis unavailable".
// `signal` lets the caller cancel the request (e.g. user stepped to another action).
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
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  return res.json();
}
