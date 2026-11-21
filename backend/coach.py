"""The analysis pipeline for one hero decision, without login or database:

    poker math -> hand strength -> prompt -> Claude -> tidy answer

Used by /analyze (main.py) and by scripts/make_sample_analysis.py.
"""

import llm
from hand_strength import hand_strength
from models import AnalyzeResponse, Hand, Recommendation
from poker_math import decision_math
from prompt import SYSTEM_PROMPT, board_through, build_prompt


def analyze_decision(hand: Hand, index: int) -> tuple[AnalyzeResponse, dict]:
    """Returns (the answer, a summary of the Claude call). Raises llm.LLMError on failure."""
    # 1. Work out the numbers.
    math = decision_math(hand, index)

    # 2. Work out what Hero has and which hands beat it (on the board shown so far).
    hero = next(p for p in hand.players if p.position == hand.hero)
    board = board_through(hand, math.street)
    strength = None
    if hero.cards:
        strength = hand_strength(hero.cards, board)

    # 3. Write the question, 4. ask Claude.
    question = build_prompt(hand, index, math, strength)
    answer, call = llm.ask_claude(SYSTEM_PROMPT, question)

    # 5. Tidy up. Sizing only makes sense for bet or raise.
    sizing = None
    if answer.action in ("bet", "raise"):
        sizing = answer.sizing

    # Preflop there is no board to describe.
    theory = answer.theory
    if math.street == "preflop":
        theory = theory.model_copy(update={"board_texture": ["N/A"]})

    # No notes means there is nothing to read from them.
    exploitative = answer.exploitative
    if not hand.notes.strip():
        exploitative = exploitative.model_copy(update={"reads": []})

    response = AnalyzeResponse(
        action_index=index,
        recommendation=Recommendation(action=answer.action, sizing=sizing, confidence=answer.confidence),
        theory=theory,
        exploitative=exploitative,
    )
    return response, call
