"""Pre-make Claude's answers for the sample hands, for guests (no login, no cost per guest).

Writes frontend/src/data/sample-analysis.json: {hand_id: {action_index: answer}}.
Costs about 1 cent per decision (~14 decisions). Re-run after changing the prompt
or the sample hands:

    cd backend && .venv/bin/python scripts/make_sample_analysis.py
"""

import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND / ".env")

import coach  # noqa: E402
from models import Hand  # noqa: E402

OUTPUT = BACKEND.parent / "frontend" / "src" / "data" / "sample-analysis.json"


def hero_decisions(hand: Hand) -> list[int]:
    indexes = []
    for index, action in enumerate(hand.actions):
        if action.position == hand.hero:
            indexes.append(index)
    return indexes


def main() -> None:
    samples = json.loads((BACKEND / "sample_hands.json").read_text())

    # Every (hand, decision) pair, run in parallel.
    jobs = []
    for sample in samples:
        hand = Hand.model_validate(sample)
        for index in hero_decisions(hand):
            jobs.append((hand, index))

    def run(job):
        hand, index = job
        response, call = coach.analyze_decision(hand, index)
        return hand.id, index, response, call

    output: dict = {}
    total_cost = 0.0
    with ThreadPoolExecutor(max_workers=6) as pool:
        for hand_id, index, response, call in pool.map(run, jobs):
            output.setdefault(hand_id, {})[str(index)] = response.model_dump(mode="json")
            total_cost += call["cost_usd"]
            print(f"  {hand_id} action {index}: {response.recommendation.action}")

    OUTPUT.write_text(json.dumps(output, indent=2) + "\n")
    print(f"Wrote {len(jobs)} answers to {OUTPUT.relative_to(BACKEND.parent)}  (~${total_cost:.2f})")


if __name__ == "__main__":
    main()
