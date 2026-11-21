import { useEffect, useState } from "react";
import type { Hand } from "../lib/hand";
import { formatMoney, useMoney } from "../lib/money";
import { replayAt } from "../lib/replay";
import { deleteHand, listHands, setFavorite, type SavedHand } from "../lib/storage";
import { PlayingCard } from "./PlayingCard";

// Same columns for the header and every row.
const grid = "grid grid-cols-[1.5rem_minmax(0,1fr)_3.5rem_4rem_4.5rem_6rem_12rem_5rem_11.5rem] items-center gap-3 px-4";
const btn = "rounded-md px-2.5 py-1 text-sm font-semibold text-white";

export function HandsList({ onOpen, onEdit, onNew }: { onOpen: (hand: Hand) => void; onEdit: (hand: Hand) => void; onNew: () => void }) {
  const [rows, setRows] = useState<SavedHand[] | null>(null); // null = still loading
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const { unit } = useMoney();

  // Load the hands (from this browser for guests, from the database when logged in).
  const reload = () => {
    listHands()
      .then((saved) => {
        setRows(saved);
        setLoadError(null);
      })
      .catch((e: Error) => setLoadError(e.message));
  };
  useEffect(reload, []);

  const remove = async (id: string) => {
    setConfirming(null);
    await deleteHand(id);
    reload();
  };

  // Flip the star right away, then save it.
  const toggleStar = async (id: string, favorite: boolean) => {
    setRows((current) => (current ?? []).map((row) => (row.hand.id === id ? { ...row, favorite } : row)));
    await setFavorite(id, favorite);
  };

  if (loadError) return <div className="p-10 text-center text-red-400">Couldn't load your hands: {loadError}</div>;
  if (rows === null) return <div className="p-10 text-center text-ink-faint">Loading hands...</div>;

  return (
    <div className="space-y-2">
      <div className={grid + " pb-2 border-b-2 border-line-strong text-sm font-bold text-ink-dim"}>
        <span />
        <span>Name</span>
        <span>Game</span>
        <span>Format</span>
        <span>Blinds</span>
        <span>Cards</span>
        <span>Board</span>
        <span>Pot</span>
        <span>Actions</span>
      </div>
      {rows.map(({ hand: h, favorite }) => {
        const hero = h.players.find((p) => p.position === h.hero)!;
        const pot = replayAt(h, h.actions.length).pot;
        const board = [...(h.board.flop ?? [null, null, null]), h.board.turn, h.board.river];
        return (
          <div key={h.id} className={grid + " rounded-2xl border border-line bg-panel py-3"}>
            <button
              type="button"
              title={favorite ? "Unfavorite" : "Favorite"}
              onClick={() => toggleStar(h.id, !favorite)}
              className={"text-xl leading-none " + (favorite ? "text-yellow-400" : "text-ink-faint hover:text-ink-dim")}
            >
              {favorite ? "★" : "☆"}
            </button>
            <span className="font-bold truncate">{h.name}</span>
            <span>NLHE</span>
            <span>{h.game.format === "cash" ? "Cash" : "Tourney"}</span>
            <span>
              ${h.game.sb}/${h.game.bb}
            </span>
            <span className="flex gap-1">
              {hero.cards ? hero.cards.map((c) => <PlayingCard key={c} card={c} size="xs" />) : <span className="text-ink-faint">?</span>}
            </span>
            <span className="flex gap-1">
              {board.map((c, i) => (c ? <PlayingCard key={i} card={c} size="xs" /> : <span key={i} className="w-8 h-10 rounded-md border border-dashed border-line-strong" />))}
            </span>
            <span className="font-semibold">{formatMoney(pot, h.game.bb, unit)}</span>
            <span className="flex gap-1.5">
              <button type="button" className="rounded-md border border-nav-border bg-nav px-2.5 py-1 text-sm font-semibold text-nav-ink hover:opacity-85" onClick={() => onOpen(h)}>
                Open
              </button>
              <button type="button" className={btn + " bg-green-600 hover:bg-green-500"} onClick={() => onEdit(h)}>
                Edit
              </button>
              <button
                type="button"
                className={btn + " bg-red-600 hover:bg-red-500"}
                onClick={() => (confirming === h.id ? remove(h.id) : setConfirming(h.id))}
                onBlur={() => setConfirming(null)}
              >
                {confirming === h.id ? "Sure?" : "Delete"}
              </button>
            </span>
          </div>
        );
      })}
      <button
        type="button"
        onClick={onNew}
        title="New hand"
        className="w-full h-16 rounded-2xl border border-line bg-panel text-3xl font-bold text-ink-dim hover:bg-raised-hover"
      >
        +
      </button>
    </div>
  );
}
