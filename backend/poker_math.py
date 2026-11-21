"""Poker math for one hero decision. The LLM never does arithmetic; these numbers go into its prompt.

Same rules as frontend/src/lib/replay.ts: replay the action list up to the decision
and work everything out from it. Nothing is stored in the hand.
"""

from dataclasses import dataclass
from typing import Optional

from models import Hand


@dataclass
class DecisionMath:
    street: str
    pot: float  # everything in the middle, including bets on this street
    to_call: float  # what hero must add to call (0 = nobody has bet)
    pot_odds: Optional[float]  # share of the final pot hero pays to call, e.g. 0.33; None if nothing to call
    hero_stack: float  # hero's chips behind, right now
    villain_stack: float  # villain's chips behind, right now
    hero_committed: float  # what hero has put in on this street so far
    villain_committed: float  # what villain has put in on this street so far (his bet, if he bet)
    effective_stack: float  # smaller stack at the start of this street
    spr: float  # effective stack / pot, at the start of this street


def decision_math(hand: Hand, index: int) -> DecisionMath:
    """Numbers for hero's decision at hand.actions[index] (the table *before* that action)."""
    villain = next(p.position for p in hand.players if p.position != hand.hero)

    # Running totals while we replay.
    stack = {p.position: p.stack for p in hand.players}  # chips behind
    committed = {p.position: 0.0 for p in hand.players}  # put in on the current street
    pot = 0.0

    def commit(pos: str, total: float) -> None:
        # Amounts are street totals, so only add the difference.
        nonlocal pot
        delta = total - committed[pos]
        stack[pos] -= delta
        committed[pos] = total
        pot += delta

    # Antes go straight in the pot. Heads-up, the button posts the small blind.
    for pos in stack:
        stack[pos] -= hand.game.ante
        pot += hand.game.ante
    sb_pos = "SB" if "SB" in stack else "BTN"
    commit(sb_pos, hand.game.sb)
    commit("BB", hand.game.bb)

    # Snapshot at the start of each street, for SPR.
    street = "preflop"
    street_start = (pot, dict(stack))

    # Replay every action before the decision.
    target = hand.actions[index]
    for a in hand.actions[:index]:
        if a.street != street:
            street = a.street
            committed = {p: 0.0 for p in committed}
            street_start = (pot, dict(stack))
        if a.action in ("call", "bet", "raise"):
            commit(a.position, a.amount)

    # The decision may be the first action of a new street.
    if target.street != street:
        street = target.street
        committed = {p: 0.0 for p in committed}
        street_start = (pot, dict(stack))

    to_call = max(committed.values()) - committed[hand.hero]
    start_pot, start_stack = street_start
    effective = min(start_stack[hand.hero], start_stack[villain])

    return DecisionMath(
        street=street,
        pot=pot,
        to_call=to_call,
        pot_odds=to_call / (pot + to_call) if to_call > 0 else None,
        hero_stack=stack[hand.hero],
        villain_stack=stack[villain],
        hero_committed=committed[hand.hero],
        villain_committed=committed[villain],
        effective_stack=effective,
        spr=effective / start_pot,
    )
