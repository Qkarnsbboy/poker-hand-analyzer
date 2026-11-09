import { describe, expect, it } from "vitest";
import { amountError, blockingReason, draftStatus, draftToHand, newDraft, nextSlot } from "./builder";
import type { Draft } from "./builder";
import type { Action } from "./hand";
import { replayAt } from "./replay";

function draft(actions: Action[] = [], overrides: Partial<Draft> = {}): Draft {
  const d = newDraft();
  d.cards = { ...d.cards, hero0: "As", hero1: "Kd", board0: "Qs", board1: "Jh", board2: "2h", board3: "7c", board4: "3d" };
  return { ...d, actions, ...overrides };
}

const turnOf = (d: Draft) => {
  const s = draftStatus(d);
  if (s.kind !== "act") throw new Error("expected act, got " + s.kind);
  return s.turn;
};

const raise = (position: "BTN" | "BB", amount: number, street: Action["street"] = "preflop"): Action => ({ street, position, action: "raise", amount });
const call = (position: "BTN" | "BB", amount: number, street: Action["street"] = "preflop"): Action => ({ street, position, action: "call", amount });
const check = (position: "BTN" | "BB", street: Action["street"]): Action => ({ street, position, action: "check" });

describe("draftStatus", () => {
  it("asks for hero cards first", () => {
    const d = newDraft();
    expect(draftStatus(d).kind).toBe("need-hero-cards");
    expect(nextSlot(d, draftStatus(d))).toBe("hero0");
  });

  it("rejects bad setup", () => {
    expect(draftStatus(draft([], { bb: "" })).kind).toBe("setup");
    expect(draftStatus(draft([], { sb: "5", bb: "2" })).kind).toBe("setup");
    expect(draftStatus(draft([], { heroStack: "1" })).kind).toBe("setup");
  });

  it("starts preflop with the button facing the big blind", () => {
    const t = turnOf(draft());
    expect(t).toMatchObject({ street: "preflop", position: "BTN", toCall: 1, currentBet: 2, raiseKind: "raise" });
  });

  it("gives the big blind an option after a limp", () => {
    const t = turnOf(draft([call("BTN", 2)]));
    expect(t).toMatchObject({ position: "BB", toCall: 0, raiseKind: "raise" });
  });

  it("moves to the flop after a raise and call, big blind first", () => {
    const t = turnOf(draft([raise("BTN", 6), call("BB", 6)]));
    expect(t).toMatchObject({ street: "flop", position: "BB", toCall: 0, currentBet: 0, raiseKind: "bet" });
  });

  it("asks for the flop before acting on it", () => {
    const d = draft([raise("BTN", 6), call("BB", 6)]);
    d.cards = { ...d.cards, board2: null };
    expect(draftStatus(d)).toEqual({ kind: "need-board", street: "flop" });
    expect(nextSlot(d, draftStatus(d))).toBe("board2");
  });

  it("keeps a street open after one check", () => {
    const t = turnOf(draft([raise("BTN", 6), call("BB", 6), check("BB", "flop")]));
    expect(t).toMatchObject({ street: "flop", position: "BTN" });
  });

  it("is complete after a fold", () => {
    const d = draft([{ street: "preflop", position: "BTN", action: "fold" }]);
    expect(draftStatus(d).kind).toBe("complete");
  });

  it("is complete after river action closes", () => {
    const d = draft([
      raise("BTN", 6),
      call("BB", 6),
      check("BB", "flop"),
      check("BTN", "flop"),
      check("BB", "turn"),
      check("BTN", "turn"),
      check("BB", "river"),
      check("BTN", "river"),
    ]);
    expect(draftStatus(d).kind).toBe("complete");
  });

  it("caps bets at the effective stack and removes raising against an all-in", () => {
    const d = draft([raise("BTN", 100)], { villainStack: "100" });
    const t = turnOf(d);
    expect(t).toMatchObject({ position: "BB", toCall: 98, maxAmount: 100, raiseKind: null });
    expect(turnOf(draft([], { villainStack: "100" })).maxAmount).toBe(100);
  });

  it("only asks for cards after both players are all-in", () => {
    const d = draft([raise("BTN", 200), call("BB", 200)]);
    d.cards = { ...d.cards, board3: null, board4: null };
    expect(draftStatus(d)).toEqual({ kind: "need-board", street: "turn" });
    d.cards = { ...d.cards, board3: "7c", board4: "3d" };
    expect(draftStatus(d).kind).toBe("complete");
  });

  it("flags a board card cleared after later action", () => {
    const d = draft([raise("BTN", 6), call("BB", 6), check("BB", "flop")]);
    d.cards = { ...d.cards, board0: null };
    expect(draftStatus(d)).toEqual({ kind: "need-board", street: "flop" });
  });
});

describe("amountError", () => {
  const t = turnOf(draft());
  it("accepts a legal raise", () => expect(amountError(t, 6)).toBeNull());
  it("rejects a raise that doesn't exceed the bet", () => expect(amountError(t, 2)).not.toBeNull());
  it("rejects more than the effective stack", () => expect(amountError(t, 201)).not.toBeNull());
  it("rejects junk", () => expect(amountError(t, NaN)).not.toBeNull());
});

describe("blockingReason", () => {
  const folded: Action[] = [{ street: "preflop", position: "BTN", action: "fold" }];
  it("allows a complete hand with no villain cards", () => {
    const d = draft(folded);
    expect(blockingReason(d, draftStatus(d))).toBeNull();
  });
  it("blocks on a single villain card", () => {
    const d = draft(folded);
    d.cards = { ...d.cards, villain0: "Tc" };
    expect(blockingReason(d, draftStatus(d))).toMatch(/second card/);
  });
});

describe("draftToHand", () => {
  it("builds a replayable hand", () => {
    const hand = draftToHand(draft([raise("BTN", 6), call("BB", 6)], { name: " Test ", heroPosition: "BB" }), "h1");
    expect(hand).toMatchObject({ id: "h1", name: "Test", hero: "BB" });
    expect(hand.players.map((p) => p.position)).toEqual(["BB", "BTN"]);
    expect(replayAt(hand, 2).pot).toBe(12);
  });

  it("names an unnamed hand", () => expect(draftToHand(draft()).name).toBe("Untitled hand"));
});
