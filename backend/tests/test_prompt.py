# Checks the text we send Claude: right numbers, right cards, no peeking ahead.

from models import Hand
from poker_math import decision_math
from prompt import build_prompt, legal_actions
from tests.hands import COMBO, HAND

aces = Hand.model_validate(HAND)
combo = Hand.model_validate(COMBO)


def prompt_for(hand, i):
    return build_prompt(hand, i, decision_math(hand, i))


def test_river_shove_has_numbers_and_full_board():
    p = prompt_for(aces, 9)
    assert "As Ah" in p
    assert "Ks Jc 3s 4h 2d" in p
    assert "Pot: $800" in p
    assert "To call: $400" in p
    assert "needs 33% equity" in p
    assert "(all-in)" in p
    assert "Legal actions: fold, call." in p  # villain is all-in, so no raise


def test_flop_spot_hides_turn_and_river():
    p = prompt_for(aces, 4)
    assert "Ks Jc 3s" in p
    assert "4h" not in p
    assert "2d" not in p
    assert "Legal actions: fold, call, raise." in p


def test_checked_to_hero_can_check_or_bet():
    p = prompt_for(aces, 6)
    assert "nothing (Hero can check)" in p
    assert "Pot odds" not in p
    assert "Legal actions: check, bet." in p


def test_villain_type_and_unknown_cards():
    p = prompt_for(combo, 8)
    assert "TAG" in p
    assert "cards unknown" in p
    assert "Villain type: LAG" in prompt_for(aces, 9)


def test_action_history_in_order():
    p = prompt_for(aces, 9)
    assert p.index("Hero raises $15") < p.index("Villain raises $50") < p.index("Villain bets $400")
    assert p.strip().endswith("Legal actions: fold, call.")


def test_legal_actions_hero_cannot_raise_when_short():
    m = decision_math(combo, 8)  # hero has exactly 119 behind, 119 to call
    assert legal_actions(m) == ["fold", "call"]
