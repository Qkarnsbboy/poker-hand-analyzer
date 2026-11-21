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

theory (the balanced, GTO-style view against an unknown, balanced opponent):
- hero_range: Hero's range in this spot, and where Hero's actual hand fits in it.
- villain_range: the hands Villain can have, given every action so far.
- board_texture: how the board (draws, pairs, scare cards) affects both ranges.
  Preflop there is no board: return ["N/A"].
- bet_sizing: what the pot odds, SPR and the sizing options mean here.

Theory bullets must not use anything specific to this Villain: no player type, no reads,
no notes, no tilt, no tendencies. Those belong only in the exploitative buckets.

exploitative (how to adjust against this Villain):
- theory_baseline: the default play from theory, in one simple bullet.
- player_type: how this player type deviates from theory here. If the type is unknown,
  use how a typical player at these stakes plays this spot.
- reads: what the notes suggest (timing, table talk, background, past showdowns).
  Use an empty list if there are no notes.
- adjustment: given all of this, the recommended play and why.

How to write:
- Every bullet states one final, correct fact. Never correct yourself in a bullet
  ("... actually ..."), and never contradict another bullet.
- Use the position given in the spot. Do not work out position yourself.
- Write reads as plain facts about Villain, never as "the notes say" or "according to
  the notes". For example: "Villain has been coolered a few times, so he may call down
  more and bluff less."

Only use what Hero knew at this decision:
- Use only the cards and actions shown so far. Never mention later streets, later cards
  or later actions, and do not guess them.
- The notes cover the whole hand. Ignore any part of the notes about what happened
  after this decision (for example, a tank or a call on a later street).

Hand strength:
- "Hands that beat Hero" is calculated and correct. Only those hands beat Hero; every
  other hand loses. Do not say any other hand beats Hero, and do not call a hand from
  that list a bluff or a weaker hand. Judge which of those hands are likely in Villain's
  range, given the action.
- Do not quote combo counts, and only mention blockers when they change the decision.
  That usually happens only in close river spots with a narrow range.

Standard strategy to follow:
- As the big blind after calling preflop, do not lead (donk) into the preflop raiser on
  the flop. Check to the raiser.
- Flop bets are usually 33% pot, or 75% pot with a polarized range.
- Turn bets are usually 75% pot, sometimes 150% pot (overbet).
- River bets are usually 50% or 75% pot. Jam all-in when the jam is about 200% pot or less.
- Raises are usually 2.5x to 5x Villain's bet, depending on the size of the bet.

Numbers:
- Do not do arithmetic. Use the pot, to-call, Villain's bet size, pot odds and SPR exactly
  as given.
- Pick one of the legal actions listed. For bet or raise, pick one amount from the
  sizing options given, and give it as the total for this street. Otherwise sizing is null.
- If Villain's cards are unknown, reason about Villain's range."""

# Standard bet sizes per street, as a share of the pot.
BET_SIZES = {
    "flop": [0.33, 0.75],
    "turn": [0.75, 1.50],
    "river": [0.50, 0.75],
}

# Standard raise sizes, as a multiple of Villain's bet.
RAISE_SIZES = [2.5, 3, 4, 5]

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


def position_line(hero_position: str) -> str:
    """Heads-up, the button acts last after the flop. Stated so Claude never guesses it."""
    if hero_position == "BTN":
        return "Position: Hero is on the button, IN position after the flop (Hero acts last)."
    return "Position: Hero is in the big blind, OUT of position after the flop (Hero acts first)."


def facing_line(m: DecisionMath) -> Optional[str]:
    """How big Villain's bet or raise is, so Claude never works out bet sizes itself."""
    if m.to_call == 0:
        return None

    # Villain bet into Hero (Hero has nothing in yet this street).
    if m.hero_committed == 0:
        pot_before_bet = m.pot - m.villain_committed
        share = m.villain_committed / pot_before_bet
        return f"  Villain's bet: {money(m.villain_committed)} into {money(pot_before_bet)} ({share:.0%} pot)"

    # Villain raised Hero's bet.
    multiple = m.villain_committed / m.hero_committed
    return f"  Villain's raise: to {money(m.villain_committed)}, {multiple:.1f}x Hero's {money(m.hero_committed)}"


def legal_actions(m: DecisionMath) -> list[str]:
    """What Hero is allowed to do here."""
    if m.to_call == 0:
        return ["check", "bet"] if m.villain_stack > 0 and m.hero_stack > 0 else ["check"]
    # Facing a bet: can only raise if both players have chips left over after calling.
    can_raise = m.villain_stack > 0 and m.hero_stack > m.to_call
    return ["fold", "call", "raise"] if can_raise else ["fold", "call"]


def round_amount(amount: float, big_blind: float) -> float:
    """Whole dollars, or cents in games with blinds under $1."""
    if big_blind >= 1:
        return float(round(amount))
    return round(amount, 2)


def sizing_options(m: DecisionMath, big_blind: float) -> list[str]:
    """The standard sizes for Hero's bet or raise, already worked out in dollars.

    Every amount is the total for this street (the same rule as the hand's actions).
    """
    actions = legal_actions(m)
    all_in_total = m.hero_stack + m.hero_committed
    options = []

    if "bet" in actions:
        for share in BET_SIZES.get(m.street, []):
            total = round_amount(share * m.pot, big_blind)
            if total < all_in_total:
                options.append(f"bet {money(total)} ({share:.0%} pot)")
        options.append(f"all-in {money(all_in_total)} ({all_in_total / m.pot:.0%} pot)")

    if "raise" in actions:
        for multiple in RAISE_SIZES:
            total = round_amount(multiple * m.villain_committed, big_blind)
            if total < all_in_total:
                options.append(f"raise to {money(total)} ({multiple:g}x)")
        options.append(f"all-in {money(all_in_total)}")

    return options


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
        position_line(hero.position),
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
    facing = facing_line(m)
    if facing:
        lines.append(facing)
    if m.pot_odds is not None:
        lines.append(f"  Pot odds: Hero needs {m.pot_odds:.0%} equity to call")
    lines += [
        f"  Hero stack behind: {money(m.hero_stack)}",
        f"  Villain stack behind: {money(m.villain_stack)}" + (" (all-in)" if m.villain_stack == 0 else ""),
        f"  SPR at the start of the {m.street}: {m.spr:.1f}",
        "",
        f"Legal actions: {', '.join(legal_actions(m))}.",
    ]

    # The bet or raise sizes to choose from (no arithmetic for Claude).
    sizes = sizing_options(m, g.bb)
    if sizes:
        lines.append(f"Sizing options: {'; '.join(sizes)}.")

    # Hand-strength facts (none before the flop).
    if strength:
        show_counts = m.street == "river"  # combos only matter in condensed river spots
        lines += ["", "Hand strength (already calculated, correct):", describe(strength, show_counts)]
    return "\n".join(lines)
