import type { Action, Card, Hand } from "../lib/hand";
import type { SeatState, TableState } from "../lib/replay";
import { CardBack, EmptyCardSlot, PlayingCard } from "./PlayingCard";

function betLabel(seat: SeatState): string | null {
  const a: Action | null = seat.lastAction;
  if (!a) return seat.committedThisStreet ? `$${seat.committedThisStreet}` : null; // blinds
  if (a.action === "fold") return "Fold";
  if (a.action === "check") return "Check";
  const verb = seat.allIn ? "All-in" : a.action[0].toUpperCase() + a.action.slice(1);
  return `${verb} $${seat.committedThisStreet}`;
}

function Chips() {
  return (
    <div className="relative w-6 h-5 shrink-0">
      <div className="absolute bottom-0 left-0 w-5 h-2.5 rounded-full bg-amber-400 border border-amber-700" />
      <div className="absolute bottom-1 left-0.5 w-5 h-2.5 rounded-full bg-neutral-100 border border-neutral-400" />
      <div className="absolute bottom-2 left-0 w-5 h-2.5 rounded-full bg-red-600 border border-red-900" />
    </div>
  );
}

function Bet({ seat }: { seat: SeatState }) {
  const label = betLabel(seat);
  if (!label) return <div className="h-6" />;
  const hasChips = seat.committedThisStreet > 0;
  return (
    <div className="h-6 flex items-center gap-1.5 text-sm font-semibold text-white drop-shadow">
      {hasChips && <Chips />}
      <span>{label}</span>
    </div>
  );
}

interface SeatProps {
  label: string;
  seat: SeatState;
  cards: [Card, Card] | null;
  showCards: boolean;
  isDealer: boolean;
  isToAct: boolean;
}

function Seat({ label, seat, cards, showCards, isDealer, isToAct }: SeatProps) {
  return (
    <div className={`flex flex-col items-center ${seat.folded ? "opacity-40" : ""}`}>
      <div className="flex gap-1 -mb-3 relative z-0">
        {showCards && cards ? (
          cards.map((c) => <PlayingCard key={c} card={c} size="sm" />)
        ) : (
          <>
            <CardBack size="sm" />
            <CardBack size="sm" />
          </>
        )}
      </div>
      <div
        className={`relative z-10 min-w-36 px-6 py-1.5 rounded-xl bg-neutral-900 border-2 text-center ${
          isToAct ? "border-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.5)]" : "border-neutral-600"
        }`}
      >
        <div className="text-sm text-neutral-300">{label}</div>
        <div className="text-lg font-bold">${seat.stack}</div>
        {isDealer && (
          <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white text-neutral-900 text-xs font-bold flex items-center justify-center border-2 border-neutral-400">
            D
          </div>
        )}
      </div>
    </div>
  );
}

export function Table({ hand, state }: { hand: Hand; state: TableState }) {
  const hero = state.seats.find((s) => s.position === hand.hero)!;
  const villain = state.seats.find((s) => s.position !== hand.hero)!;
  const cardsOf = (s: SeatState) => hand.players.find((p) => p.position === s.position)!.cards;
  // Middle pot excludes the bets still in front of players, as in PokerTracker.
  const centerPot = state.pot - state.seats.reduce((sum, s) => sum + s.committedThisStreet, 0);
  const seatProps = (s: SeatState) => ({
    seat: s,
    cards: cardsOf(s),
    isDealer: s.position === "BTN",
    isToAct: state.toAct === s.position,
  });

  return (
    <div className="relative w-full aspect-[16/11] select-none">
      {/* Felt */}
      <div className="absolute inset-x-[3%] top-[17%] bottom-[17%] rounded-[50%] border-[10px] border-neutral-950 bg-[radial-gradient(ellipse_at_center,#2f7d4a_0%,#1d5a33_60%,#14432a_100%)] shadow-[inset_0_0_40px_rgba(0,0,0,0.6),0_8px_30px_rgba(0,0,0,0.5)]" />

      {/* Villain, top */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
        <Seat label="Villain" showCards={state.isEnd} {...seatProps(villain)} />
        <Bet seat={villain} />
      </div>

      {/* Board and pot */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-5">
        <div className="flex gap-1.5">
          {Array.from({ length: 5 }, (_, i) =>
            state.board[i] ? <PlayingCard key={i} card={state.board[i]} /> : <EmptyCardSlot key={i} />,
          )}
        </div>
        <div className="text-white text-center leading-tight">
          <div className="text-sm text-white/70">Pot</div>
          <div className="text-xl font-bold">${centerPot}</div>
        </div>
      </div>

      {/* Hero, bottom */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
        <Bet seat={hero} />
        <Seat label="Hero" showCards {...seatProps(hero)} />
      </div>
    </div>
  );
}
