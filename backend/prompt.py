"""Writes the question we send to Claude. Words only: the numbers come from poker_math,
and the hand-strength facts come from hand_strength."""

from typing import Optional

from models import Hand
from hand_strength import HandStrength, describe
from poker_math import DecisionMath

# The fixed instructions. Same for every request.
SYSTEM_PROMPT = """You are a poker coach reviewing a heads-up No-Limit Hold'em cash game hand.
The player you are coaching is "Hero". The opponent is "Villain".

Recommend Hero's action at the spot described. Then explain it in these buckets.
Each bucket is a list of 1 to 3 short bullets. One idea per bullet, one sentence each.

theory (the balanced, GTO-style view):
- my_range: Hero's range in this spot, where Hero's actual hand fits in it, and any blockers Hero holds.
- villain_range: the hands Villain can have, given every action so far.
- board_texture: how the board (draws, pairs, scare cards) affects both ranges.
- bet_sizing: what the pot odds, SPR and bet sizes mean here.

exploitative (how to adjust against this Villain):
- theory_baseline: the default play from theory, in one simple bullet.
- player_type: how this player type deviates from theory here. If the type is unknown,
  use how a typical player at these stakes plays this spot.
- reads: what the notes suggest (timing, table talk, background, past showdowns).
  Use an empty list if there are no notes. Only use what happened up to this decision.
- adjustment: given all of this, the recommended play and why.

Rules:
- Hand strength is given in the spot ("Hands that beat Hero"). It is calculated and correct.
  Only those hands beat Hero; every other hand loses. Do not say any other hand beats Hero,
  and do not call a hand from that list a bluff or a weaker hand. Your job is to judge
  which of those hands are likely in Villain's range, given the action.
- Do not do arithmetic. Use the pot, to-call, pot odds and SPR exactly as given.
- Only use cards shown so far. Do not guess future streets.
- If Villain's cards are unknown, reason about Villain's range.
- Pick one of the legal actions listed. For bet or raise, give sizing as the total
  amount in dollars for this street (not the increment). Otherwise sizing is null."""

LABEL_NAMES = {
    "fish": "Fish (loose-passive, weak)",
    "station": "Calling station (calls too much, rarely folds)",
    "nit": "Nit (very tight, only plays strong hands)",
    "tag": "TAG (tight-aggressive, solid regular)",
    "lag": "LAG (loose-aggressive, bluffs often)",
    "maniac": "Maniac (hyper-aggressive, bluffs constantly)",
}


def money(x: float) -> str:
    """$12 or $12.50"""
    return f"${x:,.0f}" if x == int(x) else f"${x:,.2f}"


def board_through(hand: Hand, street: str) -> list[str]:
    """Board cards visible on this street (never future cards)."""
    b = hand.board
    cards: list[str] = []
    if street in ("flop", "turn", "river") and b.flop:
        cards += b.flop
    if street in ("turn", "river") and b.turn:
        cards.append(b.turn)
    if street == "river" and b.river:
        cards.append(b.river)
    return cards


def legal_actions(m: DecisionMath) -> list[str]:
    """What Hero is allowed to do here."""
    if m.to_call == 0:
        return ["check", "bet"] if m.villain_stack > 0 and m.hero_stack > 0 else ["check"]
    # Facing a bet: can only raise if both players have chips left over after calling.
    can_raise = m.villain_stack > 0 and m.hero_stack > m.to_call
    return ["fold", "call", "raise"] if can_raise else ["fold", "call"]


def build_prompt(hand: Hand, index: int, m: DecisionMath, strength: Optional[HandStrength] = None) -> str:
    """The per-spot message: the hand so far, the numbers, and what we want back."""
    hero = next(p for p in hand.players if p.position == hand.hero)
    villain = next(p for p in hand.players if p.position != hand.hero)
    g = hand.game
    who = lambda pos: "Hero" if pos == hand.hero else "Villain"

    lines = [
        f"Game: ${g.sb:g}/${g.bb:g} NLHE cash, heads-up.",
        f"Hero: {hero.position}, starting stack {money(hero.stack)}, cards {' '.join(hero.cards) if hero.cards else 'unknown'}.",
        f"Villain: {villain.position}, starting stack {money(villain.stack)}, "
        + (f"cards {' '.join(villain.cards)} (revealed after the hand; Hero could not see them, so decide on Villain's range, not these cards)." if villain.cards else "cards unknown."),
        f"Villain type: {LABEL_NAMES[villain.label] if villain.label else 'unknown'}.",
        f"Notes: {hand.notes.strip() or 'none'}",
        "",
        "Action so far:",
    ]

    # Action history, one street at a time, with the board as it came.
    street = None
    for a in hand.actions[:index]:
        if a.street != street:
            street = a.street
            board = board_through(hand, street)
            lines.append(f"  {street.capitalize()}" + (f" [{' '.join(board)}]" if board else "") + ":")
        amount = f" {money(a.amount)}" if a.action in ("call", "bet", "raise") else ""
        lines.append(f"    {who(a.position)} {a.action}s{amount}")
    if street != m.street:
        board = board_through(hand, m.street)
        lines.append(f"  {m.street.capitalize()}" + (f" [{' '.join(board)}]" if board else "") + ":")
    lines.append("    Hero to act.")

    # The numbers, already worked out.
    lines += [
        "",
        "Numbers at this decision (already calculated, use as given):",
        f"  Pot: {money(m.pot)}",
        f"  To call: {money(m.to_call)}" if m.to_call else "  To call: nothing (Hero can check)",
    ]
    if m.pot_odds is not None:
        lines.append(f"  Pot odds: Hero needs {m.pot_odds:.0%} equity to call")
    lines += [
        f"  Hero stack behind: {money(m.hero_stack)}",
        f"  Villain stack behind: {money(m.villain_stack)}" + (" (all-in)" if m.villain_stack == 0 else ""),
        f"  SPR at the start of the {m.street}: {m.spr:.1f}",
        "",
        f"Legal actions: {', '.join(legal_actions(m))}.",
    ]

    # Hand-strength facts (none before the flop).
    if strength:
        lines += ["", "Hand strength (already calculated, correct):", describe(strength)]
    return "\n".join(lines)
