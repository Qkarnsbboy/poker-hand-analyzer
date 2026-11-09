import { createContext, useContext } from "react";

// Amounts are always stored in dollars. This only changes how they're shown and typed.

export type Unit = "usd" | "bb";

const KEY = "unit";

export function loadUnit(): Unit {
  try {
    return localStorage.getItem(KEY) === "bb" ? "bb" : "usd";
  } catch {
    return "usd";
  }
}

export function saveUnit(unit: Unit) {
  try {
    localStorage.setItem(KEY, unit);
  } catch {
    // storage unavailable
  }
}

const round = (v: number) => Math.round(v * 100) / 100;

export function formatMoney(value: number, bb: number, unit: Unit): string {
  return unit === "bb" ? round(value / bb) + " BB" : "$" + round(value);
}

const UnitContext = createContext<Unit>("usd");
const BigBlindContext = createContext(1);

export const UnitProvider = UnitContext.Provider;
export const BigBlindProvider = BigBlindContext.Provider;

export function useMoney() {
  const unit = useContext(UnitContext);
  const bb = useContext(BigBlindContext);
  return {
    unit,
    format: (value: number) => formatMoney(value, bb, unit),
    // For amount inputs: the number to show, and the dollars a typed number means.
    toInput: (dollars: number) => (unit === "bb" ? round(dollars / bb) : round(dollars)),
    fromInput: (typed: number) => (unit === "bb" ? round(typed * bb) : typed),
  };
}
