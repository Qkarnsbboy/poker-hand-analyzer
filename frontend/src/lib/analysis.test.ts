import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultHand } from "../data/default-hand";
import type { Hand } from "./hand";

// Pretend login: tests set `token` to null (guest) or a string (logged in).
let token: string | null = null;
vi.mock("./auth", () => ({ getAccessToken: async () => token }));

import { analyzeWholeHand, getAnalysis, handFingerprint, heroDecisions, knownAnswer, LockedError, type AnalyzeResponse } from "./analysis";

// A pretend backend. Records every request path, and answers like the real one.
const answer = (i: number): AnalyzeResponse => ({
  action_index: i,
  recommendation: { action: "call", sizing: null, confidence: "medium" },
  theory: { hero_range: ["a"], villain_range: ["b"], board_texture: ["c"], bet_sizing: ["d"] },
  exploitative: { theory_baseline: ["e"], player_type: ["f"], reads: [], adjustment: ["g"] },
});
let requests: string[];
let savedOnServer: Record<string, AnalyzeResponse>;

beforeEach(() => {
  token = null;
  requests = [];
  savedOnServer = {};
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/analysis")) {
        requests.push("GET saved");
        return new Response(JSON.stringify({ results: savedOnServer }), { status: 200 });
      }
      const i = JSON.parse(init.body as string).action_index;
      requests.push(`POST analyze ${i}`);
      return new Response(JSON.stringify(answer(i)), { status: 200 });
    }),
  );
});

const flush = () => new Promise((r) => setTimeout(r, 0));

// A hand that is not a sample (so it has no pre-made answers). Unique per test.
let counter = 0;
const ownHand = (): Hand => ({ ...defaultHand, id: `own-${counter++}` });

describe("where answers come from", () => {
  it("finds every hero decision", () => {
    expect(heroDecisions(defaultHand)).toEqual([0, 2, 4, 6, 9]);
  });

  it("sample hands have pre-made answers, even for guests, with no request", async () => {
    expect(knownAnswer(defaultHand, 9)?.action_index).toBe(9);
    await expect(getAnalysis(defaultHand, 9)).resolves.toMatchObject({ action_index: 9 });
    expect(requests).toEqual([]);
  });

  it("an edited sample hand loses its pre-made answers", () => {
    const edited = { ...defaultHand, notes: "Villain is a nit." };
    expect(knownAnswer(edited, 9)).toBeNull();
  });

  it("a guest's own hand is locked", async () => {
    await expect(getAnalysis(ownHand(), 9)).rejects.toBeInstanceOf(LockedError);
    expect(requests).toEqual([]);
  });

  it("logged in, an own hand is asked from the backend", async () => {
    token = "t";
    await expect(getAnalysis(ownHand(), 9)).resolves.toMatchObject({ action_index: 9 });
    expect(requests).toEqual(["POST analyze 9"]);
  });
});

describe("pre-running a hand (logged in)", () => {
  it("loads saved answers, then asks only for the missing ones", async () => {
    token = "t";
    savedOnServer = { "0": answer(0), "2": answer(2) };
    await analyzeWholeHand(ownHand());
    await flush();
    expect(requests.sort()).toEqual(["GET saved", "POST analyze 4", "POST analyze 6", "POST analyze 9"]);
  });

  it("never asks twice for the same spot", async () => {
    token = "t";
    const hand = ownHand();
    await Promise.all([getAnalysis(hand, 9), getAnalysis(hand, 9)]);
    await getAnalysis(hand, 9); // now in memory
    expect(requests.filter((r) => r === "POST analyze 9")).toHaveLength(1);
  });

  it("does nothing for guests", async () => {
    await analyzeWholeHand(ownHand());
    expect(requests).toEqual([]);
  });

  it("a failed call can be retried", async () => {
    token = "t";
    vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", { status: 502 }));
    const hand = ownHand();
    await expect(getAnalysis(hand, 9)).rejects.toThrow();
    await expect(getAnalysis(hand, 9)).resolves.toMatchObject({ action_index: 9 });
  });
});

describe("hand fingerprint", () => {
  it("ignores key order (the database can reorder JSON keys)", () => {
    // Same hand, every object's keys in reverse order.
    const reverseKeys = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(reverseKeys);
      if (value !== null && typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(value).reverse()) out[key] = reverseKeys((value as Record<string, unknown>)[key]);
        return out;
      }
      return value;
    };
    const reordered = reverseKeys(defaultHand) as Hand;
    expect(handFingerprint({ ...defaultHand })).toBe(handFingerprint(reordered));
  });

  it("ignores the name, but not other changes", () => {
    expect(handFingerprint({ ...defaultHand, name: "Renamed" })).toBe(handFingerprint(defaultHand));
    expect(handFingerprint({ ...defaultHand, notes: "x" })).not.toBe(handFingerprint(defaultHand));
  });
});
