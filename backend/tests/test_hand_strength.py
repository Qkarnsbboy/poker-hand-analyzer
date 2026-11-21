# Checks the hand-strength facts against hands worked out by hand.

from hand_strength import describe, hand_strength


def beat_labels(strength):
    """e.g. ['Four of a Kind: 55', 'Full House: KK']"""
    labels = []
    for group in strength.beats_hero:
        labels.append(f"{group.category}: {group.hands}")
    return labels


def test_river_top_boat_river():
    # 66 on 6h 5h 2s Kh 5s = sixes full. Only quad fives and kings full beat it.
    s = hand_strength(["6s", "6d"], ["6h", "5h", "2s", "Kh", "5s"])
    assert s.hero_hand == "Full House"
    assert beat_labels(s) == ["Four of a Kind: 55", "Full House: KK"]
    assert s.total_combos == 990


def test_fives_full_does_not_beat_sixes_full():
    # The mistake Claude made: 65 here is fives full of sixes, which loses.
    s = hand_strength(["6s", "6d"], ["6h", "5h", "2s", "Kh", "5s"])
    assert "65" not in describe(s)


def test_river_top_boat_turn():
    # Set of sixes on a three-heart board: flushes, 43 and KK beat it.
    s = hand_strength(["6s", "6d"], ["6h", "5h", "2s", "Kh"])
    assert s.hero_hand == "Three of a Kind"
    assert beat_labels(s) == ["Flush: two hearts", "Straight: 43", "Three of a Kind: KK"]


def test_aces_cracked_river():
    # AA on Ks Jc 3s 4h 2d: wheel and 6-high straights, sets and two pairs beat it.
    s = hand_strength(["As", "Ah"], ["Ks", "Jc", "3s", "4h", "2d"])
    labels = beat_labels(s)
    assert labels[0] == "Straight: 65, A5"
    assert "Three of a Kind: KK, JJ, 44, 33, 22" in labels
    # The last two aces split the pot.
    assert [g.hands for g in s.ties_hero] == ["AA"]


def test_nothing_before_the_flop():
    assert hand_strength(["As", "Ah"], []) is None


def test_the_nuts():
    # Royal flush: nothing beats it.
    s = hand_strength(["As", "Ks"], ["Qs", "Js", "Ts", "2d", "3c"])
    assert s.beats_hero == []
    assert "Hero has the nuts" in describe(s)
