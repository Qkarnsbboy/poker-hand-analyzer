"""Stand-ins used by the tests: a fake database (store), a fake Claude, a fake login.

Nothing here touches Supabase or the Claude API, so tests are free, fast and repeatable.
"""

import copy

import llm
from models import Exploitative, Hand, Theory

TEST_USER = "user-1"
OTHER_USER = "user-2"


class FakeStore:
    """The same functions as store.py, kept in Python dicts instead of Postgres."""

    def __init__(self):
        self.hands = {}  # (user_id, hand_id) -> {"hand": {...}, "favorite": bool}
        self.analysis = {}  # (user_id, hand_id, action_index) -> (fingerprint, result)
        self.calls = []  # every recorded Claude call
        self.profiles = set()  # users whose sample hands were added

    # Pure functions are the real ones.
    def fingerprint(self, hand):
        import store

        return store.fingerprint(hand)

    def ensure_profile(self, user_id):
        self.profiles.add(user_id)

    def list_hands(self, user_id):
        result = []
        for (owner, _), row in self.hands.items():
            if owner == user_id:
                result.append(copy.deepcopy(row))
        return result

    def get_hand(self, user_id, hand_id):
        return copy.deepcopy(self.hands.get((user_id, hand_id)))

    def save_hand(self, user_id, hand: Hand):
        existing = self.hands.get((user_id, hand.id), {})
        self.hands[(user_id, hand.id)] = {
            "hand": hand.model_dump(mode="json", exclude_unset=True),
            "favorite": existing.get("favorite", False),
            "created_at": existing.get("created_at", "2026-11-21T12:00:00+00:00"),
        }
        return copy.deepcopy(self.hands[(user_id, hand.id)])

    def delete_hand(self, user_id, hand_id):
        if (user_id, hand_id) not in self.hands:
            return False
        del self.hands[(user_id, hand_id)]
        for key in list(self.analysis):
            if key[0] == user_id and key[1] == hand_id:
                del self.analysis[key]
        return True

    def set_favorite(self, user_id, hand_id, favorite):
        if (user_id, hand_id) not in self.hands:
            return False
        self.hands[(user_id, hand_id)]["favorite"] = favorite
        return True

    def load_analysis(self, user_id, hand_id, hand_fingerprint):
        answers = {}
        for (owner, hid, index), (fp, result) in self.analysis.items():
            if owner == user_id and hid == hand_id and fp == hand_fingerprint:
                answers[index] = copy.deepcopy(result)
        return answers

    def save_analysis(self, user_id, hand_id, action_index, hand_fingerprint, result):
        if (user_id, hand_id) in self.hands:  # same rule as the database: only for saved hands
            self.analysis[(user_id, hand_id, action_index)] = (hand_fingerprint, result)

    def record_llm_call(self, user_id, hand_id, action_index, call):
        self.calls.append({"user_id": user_id, "hand_id": hand_id, "action_index": action_index, **call})

    def month_spend(self, user_id=None):
        total = 0.0
        for call in self.calls:
            if user_id is None or call["user_id"] == user_id:
                total += call.get("cost_usd", 0)
        return total


class FakeClaude:
    """Returns a fixed answer and remembers the prompt. Set .error to make it fail."""

    def __init__(self):
        self.answer = llm.LLMAnalysis(
            action="call",
            sizing=None,
            confidence="medium",
            theory=Theory(
                hero_range=["Hero's range here."],
                villain_range=["Villain's range here."],
                board_texture=["The board."],
                bet_sizing=["The price."],
            ),
            exploitative=Exploitative(
                theory_baseline=["Call."],
                player_type=["LAGs bluff more."],
                reads=["Villain seems to overbluff."],
                adjustment=["Call more."],
            ),
        )
        self.error = None
        self.prompt = None
        self.calls = 0
        self.cost = 0.007  # dollars per fake call

    def __call__(self, system, user):
        self.calls += 1
        self.prompt = user
        if self.error:
            self.error.call = {"model": "fake", "status": "error", "cost_usd": 0, "seconds": 1.0}
            raise self.error
        call = {"model": "fake", "status": "ok", "input_tokens": 1000, "output_tokens": 400, "cost_usd": self.cost, "seconds": 1.0}
        return self.answer, call
