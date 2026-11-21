import type { AnalyzeResponse, RecommendedAction } from "../lib/analysis";

// Placeholder until slice 3 wires up POST /analyze. Content is from the wireframe.
export const mockAnalysis: AnalyzeResponse = {
  action_index: 9,
  recommendation: { action: "call", sizing: null, confidence: "medium" },
  theory: {
    my_range: ["AA is near the top of Hero's range here.", "Hero's aces block A5, the wheel."],
    villain_range: ["Value: sets and A5.", "Bluffs: missed spade draws and QT."],
    board_texture: ["The flush missed.", "The 2 completes the wheel, so most draws busted."],
    bet_sizing: ["Hero needs 33% equity to call $400 into $800.", "SPR is 1, so this is the last decision."],
  },
  exploitative: {
    theory_baseline: ["AA is a clear call against a balanced river shove."],
    player_type: ["LAGs play many draws and bluff the missed ones."],
    reads: ["The notes say Villain overbluffs."],
    adjustment: ["Call. Folding AA here loses money against this player."],
  },
};

const filler =
  "Longer explanation to stress-test the layout: on a board where the flush missed and the wheel came in, the balance between value and bluffs in villain's shoving range decides the call.";

// Dev preview: ?mock=fold|check|call|bet|raise shows that recommendation color; ?long adds overflow text.
export function mockFromUrl(): AnalyzeResponse {
  const params = new URLSearchParams(window.location.search);
  const action = params.get("mock") as RecommendedAction | null;
  if (params.has("long")) {
    // Add a long bullet to every bucket, to test how the panel handles overflow.
    const theory = { ...mockAnalysis.theory };
    const exploitative = { ...mockAnalysis.exploitative };
    for (const key of Object.keys(theory) as (keyof typeof theory)[]) theory[key] = [...theory[key], filler];
    for (const key of Object.keys(exploitative) as (keyof typeof exploitative)[]) exploitative[key] = [...exploitative[key], filler];
    return { ...mockAnalysis, theory, exploitative };
  }
  if (!action) return mockAnalysis;
  const sizing = action === "bet" || action === "raise" ? 900 : null;
  return { ...mockAnalysis, recommendation: { ...mockAnalysis.recommendation, action, sizing } };
}
