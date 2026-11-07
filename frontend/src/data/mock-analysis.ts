import type { AnalyzeResponse, RecommendedAction } from "../lib/analysis";

// Placeholder until slice 3 wires up POST /analyze. Content is from the wireframe.
export const mockAnalysis: AnalyzeResponse = {
  action_index: 9,
  recommendation: { action: "call", sizing: null, confidence: "medium" },
  theory: [
    "Heads-up, villain's river shove range is wide.",
    "AA is a strong bluff catcher here and blocks A5, the only straight.",
    "Plenty of missed draws to bluff with: QsXs flush draws and gutshots like QT.",
    "You need 33% equity to call $400 into $800.",
  ],
  exploitative: [
    "Villain is loose and plays lots of draws, so missed draws are a big part of this range.",
    "Thin value from AK or KQ is possible, but AA beats it.",
    "Villain seems to overbluff, which makes calling better than the theory baseline.",
  ],
  what_would_change_this: "Against a tight, passive player, this shove is mostly A5 and two pair or better, and folding becomes reasonable.",
};

const filler =
  "Longer explanation to stress-test the layout: on a board where the flush missed and the wheel came in, the balance between value and bluffs in villain's shoving range decides the call.";

// Dev preview: ?mock=fold|check|call|bet|raise shows that recommendation color; ?long adds overflow text.
export function mockFromUrl(): AnalyzeResponse {
  const params = new URLSearchParams(window.location.search);
  const action = params.get("mock") as RecommendedAction | null;
  if (params.has("long")) {
    const pad = (xs: string[]) => [...xs, ...Array.from({ length: 4 }, (_, i) => filler + " (" + (i + 1) + ")")];
    return { ...mockAnalysis, theory: pad(mockAnalysis.theory), exploitative: pad(mockAnalysis.exploitative) };
  }
  if (!action) return mockAnalysis;
  const sizing = action === "bet" || action === "raise" ? 900 : null;
  return { ...mockAnalysis, recommendation: { ...mockAnalysis.recommendation, action, sizing } };
}
