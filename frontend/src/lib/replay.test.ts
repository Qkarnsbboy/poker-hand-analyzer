import { describe, expect, it } from "vitest";
import { defaultHand, DEFAULT_INDEX } from "../data/default-hand";
import { replayAt, streetStartIndex } from "./replay";

const stack = (i: number, pos: string) => replayAt(defaultHand, i).seats.find((s) => s.position === pos)!.stack;

describe("replayAt", () => {
  it("posts blinds at index 0 (heads-up, BTN is the small blind)", () => {
    const t = replayAt(defaultHand, 0);
    expect(t.pot).toBe(7);
    expect(stack(0, "BTN")).toBe(698);
    expect(stack(0, "BB")).toBe(595);
    expect(t.toAct).toBe("BTN");
    expect(t.toCall).toBe(3);
    expect(t.board).toEqual([]);
  });

  it("treats amounts as totals, not increments", () => {
    // BB 3-bets to 50; BTN has 15 in, so faces 35 more.
    const t = replayAt(defaultHand, 2);
    expect(t.pot).toBe(65);
    expect(t.toCall).toBe(35);
  });

  it("resets street commitments and shows the flop on a new street", () => {
    const t = replayAt(defaultHand, 3);
    expect(t.street).toBe("flop");
    expect(t.pot).toBe(100);
    expect(t.toCall).toBe(0);
    expect(t.board).toEqual(["Ks", "Jc", "3s"]);
    expect(t.seats.every((s) => s.committedThisStreet === 0)).toBe(true);
  });

  it("matches the wireframe at the default river node", () => {
    const t = replayAt(defaultHand, DEFAULT_INDEX);
    expect(t.street).toBe("river");
    expect(t.pot).toBe(800);
    expect(t.toAct).toBe("BTN");
    expect(t.toCall).toBe(400);
    expect(t.isDecisionNode).toBe(true);
    expect(stack(DEFAULT_INDEX, "BTN")).toBe(500);
    expect(stack(DEFAULT_INDEX, "BB")).toBe(0);
    expect(t.seats.find((s) => s.position === "BB")!.allIn).toBe(true);
  });

  it("ends with the full board and no one to act", () => {
    const t = replayAt(defaultHand, defaultHand.actions.length);
    expect(t.isEnd).toBe(true);
    expect(t.toAct).toBeNull();
    expect(t.pot).toBe(1200);
    expect(t.board).toHaveLength(5);
  });

  it("clamps out-of-range indexes", () => {
    expect(replayAt(defaultHand, -5).index).toBe(0);
    expect(replayAt(defaultHand, 99).index).toBe(defaultHand.actions.length);
  });

  it("marks folds", () => {
    const folded = { ...defaultHand, actions: [{ street: "preflop" as const, position: "BTN" as const, action: "fold" as const }] };
    const t = replayAt(folded, 1);
    expect(t.seats.find((s) => s.position === "BTN")!.folded).toBe(true);
  });
});

describe("streetStartIndex", () => {
  it("finds the first action on each street", () => {
    expect(streetStartIndex(defaultHand, "preflop")).toBe(0);
    expect(streetStartIndex(defaultHand, "flop")).toBe(3);
    expect(streetStartIndex(defaultHand, "turn")).toBe(5);
    expect(streetStartIndex(defaultHand, "river")).toBe(8);
  });
});
