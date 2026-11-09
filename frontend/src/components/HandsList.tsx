import { useState } from "react";
import type { Hand } from "../lib/hand";
import { deleteHand, loadHands } from "../lib/storage";
import { PlayingCard } from "./PlayingCard";

const btn = "rounded-md border border-line-strong bg-raised px-3 py-1 text-sm hover:bg-raised-hover";

export function HandsList({ onOpen }: { onOpen: (hand: Hand) => void }) {
  const [hands, setHands] = useState<Hand[]>(loadHands);
  const [confirming, setConfirming] = useState<string | null>(null);

  if (hands.length === 0) {
    return <div className="rounded-2xl border border-line bg-panel p-10 text-center text-ink-faint">No saved hands yet. Add one with New Hand.</div>;
  }

  const remove = (id: string) => {
    deleteHand(id);
    setHands(loadHands());
    setConfirming(null);
  };

  return (
    <div className="space-y-2">
      {hands.map((h) => {
        const hero = h.players.find((p) => p.position === h.hero)!;
        const board = [...(h.board.flop ?? []), h.board.turn, h.board.river].filter((c): c is string => Boolean(c));
        return (
          <div key={h.id} className="rounded-2xl border border-line bg-panel p-3 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">{h.name}</div>
              <div className="text-xs text-ink-faint">
                ${h.game.sb}/${h.game.bb} · Hero {h.hero} · {h.actions.length} actions
              </div>
            </div>
            <div className="flex gap-1">{hero.cards?.map((c) => <PlayingCard key={c} card={c} size="xs" />)}</div>
            <div className="flex gap-1 w-44">{board.map((c) => <PlayingCard key={c} card={c} size="xs" />)}</div>
            <button type="button" className={btn} onClick={() => onOpen(h)}>
              Open
            </button>
            {confirming === h.id ? (
              <button type="button" className={btn + " border-red-500 text-red-500"} onClick={() => remove(h.id)}>
                Confirm delete
              </button>
            ) : (
              <button type="button" className={btn} onClick={() => setConfirming(h.id)}>
                Delete
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
