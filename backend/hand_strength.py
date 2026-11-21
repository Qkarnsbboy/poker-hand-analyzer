"""Hand-strength facts for the prompt: what Hero has, and which Villain hands beat it.

Claude made mistakes when it worked out hand rankings itself (for example, it said
fives full beats sixes full). So the code works it out, and Claude only judges which
of these hands are in Villain's range.

Uses the `treys` library to rank hands. Lower treys score = stronger hand.
"""

from dataclasses import dataclass
from itertools import combinations
from typing import Optional

from treys import Card, Evaluator

RANKS = "23456789TJQKA"
SUITS = "shdc"
SUIT_NAMES = {"s": "spades", "h": "hearts", "d": "diamonds", "c": "clubs"}

# Show at most this many hands per group, so the prompt stays short.
MAX_HANDS_PER_GROUP = 8

evaluator = Evaluator()


@dataclass
class HandGroup:
    category: str  # e.g. "Full House"
    hands: str  # e.g. "KK" or "two hearts"
    combos: int  # how many two-card combos are in this group


@dataclass
class HandStrength:
    hero_hand: str  # e.g. "Full House"
    total_combos: int  # every two-card hand Villain could hold
    beats_hero: list[HandGroup]
    ties_hero: list[HandGroup]


def full_deck() -> list[str]:
    deck = []
    for rank in RANKS:
        for suit in SUITS:
            deck.append(rank + suit)
    return deck


def score(cards: list[str], board: list[str]) -> int:
    """treys score for two hole cards on this board. Lower is stronger."""
    hand = [Card.new(card) for card in cards]
    table = [Card.new(card) for card in board]
    return evaluator.evaluate(table, hand)


def category_of(points: int) -> str:
    """e.g. 'Full House', 'Flush'."""
    return evaluator.class_to_string(evaluator.get_rank_class(points))


def rank_label(cards: tuple[str, str]) -> str:
    """Two cards as ranks, high card first, no suits: ('5c', 'Kd') -> 'K5'."""
    first, second = cards[0][0], cards[1][0]
    if RANKS.index(first) < RANKS.index(second):
        first, second = second, first
    return first + second


def group_hands(hands: list[tuple[str, str]], board: list[str]) -> list[HandGroup]:
    """Turn a list of combos into short groups, strongest category first."""
    # Sort the combos into categories (Flush, Straight, ...).
    by_category: dict[str, list[tuple[str, str]]] = {}
    best_score: dict[str, int] = {}
    for cards in hands:
        points = score(list(cards), board)
        category = category_of(points)
        by_category.setdefault(category, []).append(cards)
        best_score[category] = min(points, best_score.get(category, points))

    groups = []
    for category in sorted(by_category, key=lambda c: best_score[c]):
        combos = by_category[category]

        # Flushes: say "two hearts", not every heart combo.
        if category in ("Flush", "Straight Flush"):
            suits = sorted({cards[0][1] for cards in combos if cards[0][1] == cards[1][1]})
            if len(suits) == 1:
                groups.append(HandGroup(category, f"two {SUIT_NAMES[suits[0]]}", len(combos)))
                continue

        # Everything else: rank pairs like "KK" or "43", strongest first.
        labels: list[str] = []
        for cards in sorted(combos, key=lambda c: score(list(c), board)):
            label = rank_label(cards)
            if label not in labels:
                labels.append(label)
        shown = ", ".join(labels[:MAX_HANDS_PER_GROUP])
        if len(labels) > MAX_HANDS_PER_GROUP:
            shown += f", +{len(labels) - MAX_HANDS_PER_GROUP} more"
        groups.append(HandGroup(category, shown, len(combos)))
    return groups


def hand_strength(hero_cards: list[str], board: list[str]) -> Optional[HandStrength]:
    """Facts about Hero's hand on this board. None before the flop (no board yet)."""
    if len(board) < 3:
        return None

    hero_score = score(hero_cards, board)

    # Every two cards Villain could hold: anything not in Hero's hand or on the board.
    unseen = []
    for card in full_deck():
        if card not in hero_cards and card not in board:
            unseen.append(card)

    beats = []
    ties = []
    total = 0
    for villain_cards in combinations(unseen, 2):
        total += 1
        villain_score = score(list(villain_cards), board)
        if villain_score < hero_score:
            beats.append(villain_cards)
        elif villain_score == hero_score:
            ties.append(villain_cards)

    return HandStrength(
        hero_hand=category_of(hero_score),
        total_combos=total,
        beats_hero=group_hands(beats, board),
        ties_hero=group_hands(ties, board),
    )


def combos_text(count: int) -> str:
    if count == 1:
        return "1 combo"
    return f"{count} combos"


def group_line(group: HandGroup, show_counts: bool) -> str:
    """One line for the prompt, e.g. '  - Full House: KK (3 combos)'."""
    line = f"  - {group.category}: {group.hands}"
    if show_counts:
        line += f" ({combos_text(group.combos)})"
    return line


def describe(strength: HandStrength, show_counts: bool = False) -> str:
    """The lines that go into the prompt.

    Combo counts only matter in condensed river spots, so they are left out
    unless show_counts is True.
    """
    lines = [f"Hero's hand: {strength.hero_hand}."]

    if not strength.beats_hero:
        lines.append("No Villain hand beats Hero (Hero has the nuts).")
    else:
        lines.append("Hands that beat Hero:")
        for group in strength.beats_hero:
            lines.append(group_line(group, show_counts))

    if strength.ties_hero:
        lines.append("Hands that tie Hero (split pot):")
        for group in strength.ties_hero:
            lines.append(group_line(group, show_counts))

    lines.append("Every other hand loses to Hero.")
    return "\n".join(lines)
