// Mirrors POST /analyze in docs/api-contract.md.

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
