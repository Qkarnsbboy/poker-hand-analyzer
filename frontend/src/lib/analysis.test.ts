import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultHand } from "../data/default-hand";
import { analyzeWholeHand, getAnalysis, heroDecisions, type AnalyzeResponse } from "./analysis";
import { deleteHand, loadAnalysis } from "./storage";

// Tests run outside a browser, so give them a pretend localStorage.
function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
}

// A pretend backend that answers instantly and counts calls.
const answer = (i: number): AnalyzeResponse => ({
  action_index: i,
  recommendation: { action: "call", sizing: null, confidence: "medium" },
  theory: ["a", "b"],
  exploitative: ["c", "d"],
  what_would_change_this: "e",
});
let calls: number[];

beforeEach(() => {
  vi.stubGlobal("localStorage", fakeStorage());
  vi.spyOn(console, "log").mockImplementation(() => {});
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const i = JSON.parse(init.body as string).action_index;
      calls.push(i);
      return new Response(JSON.stringify(answer(i)), { status: 200 });
    }),
  );
});

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("pre-running a hand", () => {
  it("finds every hero decision", () => {
    expect(heroDecisions(defaultHand)).toEqual([0, 2, 4, 6, 9]);
  });

  it("analyzes every decision once and saves the answers", async () => {
    analyzeWholeHand(defaultHand);
    await flush();
    expect(calls.sort()).toEqual([0, 2, 4, 6, 9]);
    expect(loadAnalysis(defaultHand, 9)?.action_index).toBe(9);
  });

  it("never calls twice for the same spot", async () => {
    analyzeWholeHand(defaultHand);
    analyzeWholeHand(defaultHand); // e.g. builder, then replayer opening
    await getAnalysis(defaultHand, 9);
    await flush();
    expect(calls.filter((i) => i === 9)).toHaveLength(1);
    // Saved now: asking again doesn't call.
    await getAnalysis(defaultHand, 9);
    expect(calls).toHaveLength(5);
  });

  it("editing the hand throws old answers away", async () => {
    await getAnalysis(defaultHand, 9);
    const edited = { ...defaultHand, notes: "Villain is a nit." };
    expect(loadAnalysis(edited, 9)).toBeNull();
    // Renaming alone doesn't count as a change.
    expect(loadAnalysis({ ...defaultHand, name: "Renamed" }, 9)).not.toBeNull();
  });

  it("a failed call can be retried", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", { status: 502 }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(getAnalysis(defaultHand, 9)).rejects.toThrow();
    await expect(getAnalysis(defaultHand, 9)).resolves.toMatchObject({ action_index: 9 });
  });

  it("deleting a hand deletes its answers", async () => {
    await getAnalysis(defaultHand, 9);
    deleteHand(defaultHand.id);
    expect(loadAnalysis(defaultHand, 9)).toBeNull();
  });
});
