import type { Action, Hand } from "../lib/hand";
import type { TableState } from "../lib/replay";

function describe(a: Action, allIn: boolean): string {
  if (!("amount" in a)) return a.action;
  return allIn ? `all-in $${a.amount}` : `${a.action} $${a.amount}`;
}

export function Table({ hand, state }: { hand: Hand; state: TableState }) {
  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-500 capitalize">{state.street}</div>

      <div>
        <div className="text-lg">Pot: ${state.pot}</div>
        <div className="font-mono text-xl">{state.board.length ? state.board.join(" ") : "—"}</div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {state.seats.map((seat) => {
          const player = hand.players.find((p) => p.position === seat.position)!;
          const isHero = seat.position === hand.hero;
          // Villain cards stay hidden until the end of the hand.
          const cards = isHero || state.isEnd ? player.cards : null;
          return (
            <div
              key={seat.position}
              className={`border p-3 ${state.toAct === seat.position ? "border-black" : "border-gray-300"} ${seat.folded ? "opacity-40" : ""}`}
            >
              <div className="font-semibold">
                {isHero ? "Hero" : "Villain"} ({seat.position})
              </div>
              <div>${seat.stack}</div>
              <div className="font-mono">{cards ? cards.join(" ") : "?? ??"}</div>
              <div className="text-sm text-gray-600 h-5">
                {seat.lastAction ? describe(seat.lastAction, seat.allIn) : ""}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-sm">
        {state.isEnd
          ? "End of hand"
          : `${state.toAct === hand.hero ? "Hero" : "Villain"} to act${state.toCall ? `, $${state.toCall} to call` : ""}`}
        {state.isDecisionNode && <span className="ml-2 font-semibold">(hero decision)</span>}
      </div>
    </div>
  );
}
