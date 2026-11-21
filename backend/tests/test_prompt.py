# Checks the text we send Claude: right numbers, right cards, no peeking ahead.

from models import Hand
from poker_math import decision_math
from hand_strength import hand_strength
from prompt import board_through, build_prompt, legal_actions
from tests.hands import COMBO, HAND

aces = Hand.model_validate(HAND)
combo = Hand.model_validate(COMBO)


def prompt_for(hand, i):
    """The full prompt, the same way main.py builds it."""
    math = decision_math(hand, i)
    hero = next(p for p in hand.players if p.position == hand.hero)
    strength = hand_strength(hero.cards, board_through(hand, math.street))
    return build_prompt(hand, i, math, strength)


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
    assert "Legal actions: fold, call." in p


def test_legal_actions_hero_cannot_raise_when_short():
    m = decision_math(combo, 8)  # hero has exactly 119 behind, 119 to call
    assert legal_actions(m) == ["fold", "call"]


def test_river_bet_sizes():
    # River Top Boat is not in the test hands, so use Aces Cracked's turn (pot $170, checked to Hero).
    p = prompt_for(aces, 6)
    assert "bet $128 (75% pot)" in p
    assert "bet $255 (150% pot)" in p
    assert "all-in $615" in p


def test_raise_sizes_are_multiples_of_villain_bet():
    # Flop: Villain bets $35, Hero can raise.
    p = prompt_for(aces, 4)
    assert "raise to $88 (2.5x)" in p
    assert "raise to $175 (5x)" in p


def test_no_sizing_options_when_only_fold_or_call():
    assert "Sizing options" not in prompt_for(aces, 9)


def test_combo_counts_only_on_the_river():
    assert "combo" not in prompt_for(aces, 4)  # flop
    assert "combos)" in prompt_for(aces, 9)  # river


def test_position_is_stated():
    assert "Hero is on the button, IN position" in prompt_for(aces, 9)
    assert "Hero is in the big blind, OUT of position" in prompt_for(combo, 8)


def test_villain_bet_size_is_stated():
    # River: Villain jams $400 into a $400 pot = 100% pot (not "half pot").
    assert "Villain's bet: $400 into $400 (100% pot)" in prompt_for(aces, 9)
    # Flop: $35 into $100.
    assert "Villain's bet: $35 into $100 (35% pot)" in prompt_for(aces, 4)


def test_villain_raise_is_stated():
    # Combo Draw turn: Hero bets $45, Villain raises to $164.
    assert "Villain's raise: to $164, 3.6x Hero's $45" in prompt_for(combo, 8)
