import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  amountError,
  blockingReason,
  draftStatus,
  draftToHand,
  newDraft,
  nextSlot,
  SLOT_IDS,
  SLOT_LABELS,
  STREET_SLOTS,
} from "../lib/builder";
import type { Draft, SlotId, Turn } from "../lib/builder";
import type { Action, Card, Hand, Position, Street } from "../lib/hand";
import { BigBlindProvider, formatMoney, useMoney } from "../lib/money";
import { replayAt } from "../lib/replay";
import { newHandId, saveHand } from "../lib/storage";
import { PlayingCard } from "./PlayingCard";

const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"];
const SUITS = ["s", "h", "d", "c"];

const field =
  "w-full rounded-md border border-line-strong bg-raised px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed";
const label = "block text-xs font-semibold text-ink-dim mb-1";
const box = "rounded-2xl border border-line bg-panel p-3";

const COLUMN_TITLES: Record<Street, string> = { preflop: "Preflop", flop: "Flop", turn: "Turn", river: "River" };

function Field({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <label className={className}>
      <span className={label}>{title}</span>
      {children}
    </label>
  );
}

function Slot({ card, active, title, onClick }: { card: Card | null; active: boolean; title: string; onClick: () => void }) {
  const ring = active ? " ring-2 ring-accent ring-offset-2 ring-offset-panel" : "";
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} className={"rounded-md" + ring}>
      {card ? (
        <PlayingCard card={card} size="sm" />
      ) : (
        <div className="w-10 h-14 rounded-md border border-dashed border-line-strong bg-raised/40" />
      )}
    </button>
  );
}

function CardPicker({ used, activeLabel, onPick }: { used: Set<Card>; activeLabel: string | null; onPick: (c: Card) => void }) {
  return (
    <div className={box}>
      <div className="text-xs font-semibold text-ink-dim mb-2">
        {activeLabel ? (
          <span>
            Choose: <span className="text-accent">{activeLabel}</span>
          </span>
        ) : (
          "Click a card slot to choose it"
        )}
      </div>
      <div className="space-y-1">
        {SUITS.map((s) => (
          <div key={s} className="flex gap-1">
            {RANKS.map((r) => {
              const card = r + s;
              const off = used.has(card) || !activeLabel;
              return (
                <button
                  key={card}
                  type="button"
                  disabled={off}
                  onClick={() => onPick(card)}
                  aria-label={card}
                  className={"rounded-md " + (used.has(card) ? "opacity-15" : !activeLabel ? "opacity-50" : "hover:brightness-125")}
                >
                  <PlayingCard card={card} size="xs" />
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

const actionBtn = "rounded-md px-2 py-1.5 text-sm font-bold text-white hover:brightness-110";

function ActionControls({ turn, who, onAct }: { turn: Turn; who: string; onAct: (a: Action) => void }) {
  const { unit, format, toInput, fromInput } = useMoney();
  const [amount, setAmount] = useState(String(toInput(turn.suggested)));
  const [error, setError] = useState<string | null>(null);
  const base = { street: turn.street, position: turn.position };

  const submitRaise = (value: number) => {
    const problem = amountError(turn, value);
    if (problem) return setError(problem);
    onAct({ ...base, action: turn.raiseKind!, amount: value });
  };

  return (
    <div className="mt-2 pt-2 border-t border-line space-y-1.5">
      <div className="text-sm font-semibold text-accent">{who} to act</div>
      {turn.toCall > 0 ? (
        <>
          <button type="button" className={actionBtn + " bg-blue-600 w-full"} onClick={() => onAct({ ...base, action: "fold" })}>
            Fold
          </button>
          <button type="button" className={actionBtn + " bg-green-600 w-full"} onClick={() => onAct({ ...base, action: "call", amount: turn.currentBet })}>
            Call {format(turn.toCall)}
          </button>
        </>
      ) : (
        <button type="button" className={actionBtn + " bg-slate-500 w-full"} onClick={() => onAct({ ...base, action: "check" })}>
          Check
        </button>
      )}
      {turn.raiseKind && (
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            submitRaise(fromInput(Number(amount)));
          }}
        >
          <button type="submit" className={actionBtn + " bg-red-600 capitalize flex-1"}>
            {turn.raiseKind}
          </button>
          <input
            className={field + " !w-12 !px-1 text-center shrink-0"}
            type="number"
            step="any"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
            aria-label={turn.raiseKind + " amount"}
          />
          <span className="text-xs font-semibold text-ink-dim">{unit === "bb" ? "BB" : "$"}</span>
        </form>
      )}
      {turn.raiseKind && (
        <button type="button" className={actionBtn + " bg-red-900 w-full"} onClick={() => submitRaise(turn.maxAmount)}>
          All-in {format(turn.maxAmount)}
        </button>
      )}
      {error && <div className="text-xs text-red-500">{error}</div>}
    </div>
  );
}

function actionText(a: Action, allIn: boolean, format: (v: number) => string): string {
  const verb = a.action[0].toUpperCase() + a.action.slice(1);
  return "amount" in a ? verb + " " + format(a.amount) + (allIn ? " (all-in)" : "") : verb;
}

export function HandBuilder({ onAnalyze }: { onAnalyze: (hand: Hand) => void }) {
  const [draft, setDraft] = useState<Draft>(newDraft);
  // A slot the user clicked; otherwise the picker follows the hand's flow.
  const [selected, setSelected] = useState<SlotId | null>(null);
  const [saveError, setSaveError] = useState(false);
  const { unit } = useMoney();
  const bb = Number(draft.bb) || 1;
  const format = (v: number) => formatMoney(v, bb, unit);

  const status = useMemo(() => draftStatus(draft), [draft]);
  const activeSlot = selected ?? nextSlot(draft, status);
  const blocked = blockingReason(draft, status);
  const locked = draft.actions.length > 0;
  const turn = status.kind === "act" ? status.turn : null;

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const used = new Set(SLOT_IDS.map((s) => draft.cards[s]).filter((c): c is Card => Boolean(c)));

  const clickSlot = (slot: SlotId) => {
    if (draft.cards[slot]) {
      update({ cards: { ...draft.cards, [slot]: null } });
      setSelected(slot);
    } else {
      setSelected(activeSlot === slot && selected === slot ? null : slot);
    }
  };

  const pick = (card: Card) => {
    if (!activeSlot) return;
    update({ cards: { ...draft.cards, [activeSlot]: card } });
    setSelected(activeSlot === "villain0" && !draft.cards.villain1 ? "villain1" : null);
  };

  const slot = (id: SlotId) => (
    <Slot key={id} card={draft.cards[id]} active={activeSlot === id} title={SLOT_LABELS[id]} onClick={() => clickSlot(id)} />
  );

  const who = (p: Position) => (p === draft.heroPosition ? "Hero" : "Villain");

  const rows = (street: Street) => {
    const hand = draftToHand(draft);
    return draft.actions.map((a, i) => {
      if (a.street !== street) return null;
      const seat = replayAt(hand, i + 1).seats.find((s) => s.position === a.position)!;
      return (
        <div key={i} className="flex justify-between text-sm">
          <span className="text-ink-dim">{who(a.position)}</span>
          <span>{actionText(a, seat.stack <= 0, format)}</span>
        </div>
      );
    });
  };

  // Pot through the street's latest action; null for streets not reached yet.
  const potFor = (street: Street): number | null => {
    if (status.kind === "setup") return null;
    const hand = draftToHand(draft);
    const lastOnStreet = draft.actions.map((a) => a.street).lastIndexOf(street);
    if (lastOnStreet >= 0) return replayAt(hand, lastOnStreet + 1).pot;
    const current =
      turn?.street === street ||
      (status.kind === "need-board" && status.street === street) ||
      (status.kind === "need-hero-cards" && street === "preflop");
    return current ? replayAt(hand, draft.actions.length).pot : null;
  };

  const analyze = () => {
    const hand = draftToHand(draft, newHandId());
    if (!saveHand(hand)) setSaveError(true);
    onAnalyze(hand);
  };

  const column = (street: Street, top: ReactNode) => {
    const pot = potFor(street);
    return (
    <div className={box + " min-w-0"} key={street}>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-bold">{COLUMN_TITLES[street]}</h3>
        {pot !== null && <span className="text-sm font-bold text-accent">Pot {format(pot)}</span>}
      </div>
      {top}
      <div className="space-y-1 mt-2">{rows(street)}</div>
      {turn && turn.street === street && (
        <ActionControls key={draft.actions.length + unit} turn={turn} who={who(turn.position)} onAct={(a) => update({ actions: [...draft.actions, a] })} />
      )}
    </div>
    );
  };

  const boardSlots = (s: Exclude<Street, "preflop">) => <div className="flex justify-center gap-1.5">{STREET_SLOTS[s].map(slot)}</div>;

  return (
    <BigBlindProvider value={bb}>
    <div className="space-y-3">
      <div className={box + " grid grid-cols-[2fr_1fr_1fr_0.7fr_0.7fr_1fr_1fr] gap-3"}>
        <Field title="Hand name">
          <input className={field} value={draft.name} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. Aces Cracked" />
        </Field>
        <Field title="Game">
          <input className={field} value="NLHE" disabled />
        </Field>
        <Field title="Format">
          <input className={field} value="Cash" disabled />
        </Field>
        <Field title="SB">
          <input className={field} type="number" step="any" value={draft.sb} disabled={locked} onChange={(e) => update({ sb: e.target.value })} />
        </Field>
        <Field title="BB">
          <input className={field} type="number" step="any" value={draft.bb} disabled={locked} onChange={(e) => update({ bb: e.target.value })} />
        </Field>
        <Field title="Hero stack">
          <input className={field} type="number" step="any" value={draft.heroStack} disabled={locked} onChange={(e) => update({ heroStack: e.target.value })} />
        </Field>
        <Field title="Villain stack">
          <input className={field} type="number" step="any" value={draft.villainStack} disabled={locked} onChange={(e) => update({ villainStack: e.target.value })} />
        </Field>
      </div>

      <div className="grid grid-cols-4 gap-3 items-start">
        {column(
          "preflop",
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-dim">Hero cards</span>
              <div className="flex gap-1.5">{(["hero0", "hero1"] as SlotId[]).map(slot)}</div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-dim">Hero position</span>
              <div className="flex gap-1">
                {(["BTN", "BB"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={locked}
                    onClick={() => update({ heroPosition: p })}
                    className={
                      "rounded-md border px-2 py-0.5 text-xs font-bold disabled:cursor-not-allowed " +
                      (draft.heroPosition === p ? "border-accent text-accent" : "border-line-strong text-ink-dim disabled:opacity-50")
                    }
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>,
        )}
        {column("flop", boardSlots("flop"))}
        {column("turn", boardSlots("turn"))}
        {column("river", boardSlots("river"))}
      </div>

      <div className="flex items-center gap-3 text-sm">
        <button
          type="button"
          className="rounded-md border border-line-strong bg-raised px-3 py-1 hover:bg-raised-hover disabled:opacity-40"
          disabled={!locked}
          onClick={() => update({ actions: draft.actions.slice(0, -1) })}
        >
          Undo last action
        </button>
        <button
          type="button"
          className="rounded-md border border-line-strong bg-raised px-3 py-1 hover:bg-raised-hover disabled:opacity-40"
          disabled={!locked}
          onClick={() => update({ actions: [] })}
        >
          Clear actions
        </button>
        {locked && <span className="text-xs text-ink-faint">Blinds, stacks and position lock once actions are entered.</span>}
      </div>

      <div className="flex gap-3 items-stretch">
        <CardPicker used={used} activeLabel={activeSlot ? SLOT_LABELS[activeSlot] : null} onPick={pick} />
        <div className={box + " flex-1 min-w-0 flex flex-col gap-2"}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-dim">Villain cards (optional)</span>
            <div className="flex gap-1.5">{(["villain0", "villain1"] as SlotId[]).map(slot)}</div>
          </div>
          <label className="flex-1 flex flex-col">
            <span className={label}>Additional info</span>
            <textarea
              className={field + " flex-1 resize-none min-h-14"}
              value={draft.notes}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="Villain reads, table dynamics..."
            />
          </label>
        </div>
        <div className="w-44 shrink-0 flex flex-col">
          <button
            type="button"
            disabled={blocked !== null}
            onClick={analyze}
            className="flex-1 rounded-2xl border border-line-strong bg-raised text-2xl font-bold hover:bg-raised-hover disabled:opacity-40 disabled:hover:bg-raised"
          >
            Analyze
          </button>
          <div className="mt-1.5 h-8 text-xs text-center text-ink-faint">{saveError ? "Couldn't save this hand." : blocked ?? "Ready"}</div>
        </div>
      </div>
    </div>
    </BigBlindProvider>
  );
}
