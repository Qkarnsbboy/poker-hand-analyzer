import { describe, expect, it } from "vitest";
import { SAMPLE_HANDS } from "../data/sample-hands";
import { matchesSearch, shortDate, stakesOptions, toRow } from "./hands-table";

// The 3 sample hands as table rows.
const rows = SAMPLE_HANDS.map((hand) => toRow({ hand, favorite: false, created_at: "2026-11-21T12:00:00Z" }));
const aces = rows[0]; // Aces Cracked: $2/$5, hero BTN, pot $1200

describe("hand table rows", () => {
  it("shows stakes, position and final pot", () => {
    expect(aces.stakes).toBe("$2/$5");
    expect(aces.position).toBe("BTN");
    expect(aces.pot).toBe(1200);
  });

  it("search matches name or notes, any case", () => {
    expect(matchesSearch(aces, "aces")).toBe(true);
    expect(matchesSearch(aces, "OVERBLUFF")).toBe(true); // in the notes
    expect(matchesSearch(aces, "river top")).toBe(false);
    expect(matchesSearch(aces, "  ")).toBe(true); // empty search shows everything
  });

  it("stakes filter lists each stake once, smallest first", () => {
    expect(stakesOptions(rows)).toEqual(["$1/$2", "$2/$5"]);
  });

  it("dates show as MM/DD/YYYY, unknown dates as a dash", () => {
    expect(shortDate(Date.parse("2026-11-20T12:00:00"))).toBe("11/20/2026");
    expect(shortDate(null)).toBe("—");
    expect(toRow({ hand: SAMPLE_HANDS[0], favorite: false, created_at: null }).createdAt).toBeNull();
  });
});
