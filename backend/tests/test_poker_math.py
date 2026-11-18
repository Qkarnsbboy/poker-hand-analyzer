# Checks the math against Aces Cracked, worked out by hand.
# Blinds $2/$5. Hero BTN starts with $700, villain BB with $600.
#   preflop: 50 each  -> pot 100
#   flop:    35 each  -> pot 170
#   turn:   115 each  -> pot 400
#   river:  villain shoves 400, hero to act

from pytest import approx

from models import Hand
from poker_math import decision_math
from tests.hands import HAND

hand = Hand.model_validate(HAND)


def test_preflop_open():
    # Index 0: hero (SB/BTN) has posted 2, facing the 5 big blind.
    m = decision_math(hand, 0)
    assert m.street == "preflop"
    assert m.pot == 7
    assert m.to_call == 3
    assert m.pot_odds == approx(3 / 10)
    # Start of preflop is after the blinds: stacks 698 vs 595.
    assert m.effective_stack == 595
    assert m.spr == approx(595 / 7)


def test_facing_flop_bet():
    # Index 4: villain bet 35 into 100.
    m = decision_math(hand, 4)
    assert m.street == "flop"
    assert m.pot == 135
    assert m.to_call == 35
    assert m.pot_odds == approx(35 / 170)
    assert m.effective_stack == 550  # 650 vs 550 at the start of the flop
    assert m.spr == approx(5.5)


def test_turn_bet_nothing_to_call():
    # Index 6: villain checked, hero to bet. No pot odds.
    m = decision_math(hand, 6)
    assert m.street == "turn"
    assert m.pot == 170
    assert m.to_call == 0
    assert m.pot_odds is None
    assert m.spr == approx(515 / 170)


def test_river_facing_shove():
    # Index 9: the wireframe spot. $400 to call into $800, need 33%.
    m = decision_math(hand, 9)
    assert m.street == "river"
    assert m.pot == 800
    assert m.to_call == 400
    assert m.pot_odds == approx(1 / 3)
    assert m.hero_stack == 500
    assert m.villain_stack == 0  # all-in
    assert m.effective_stack == 400
    assert m.spr == approx(1.0)


def test_hero_in_big_blind_facing_turn_shove():
    # Combo Draw, index 8: hero bet 45, villain shoved to 164.
    # Pot: 12 preflop + 60 flop = 72, plus 45 + 164 this street = 281.
    from tests.hands import COMBO

    m = decision_math(Hand.model_validate(COMBO), 8)
    assert m.street == "turn"
    assert m.pot == 281
    assert m.to_call == 119
    assert m.pot_odds == approx(119 / 400)
    assert m.hero_stack == 119
    assert m.effective_stack == 164
    assert m.spr == approx(164 / 72)
