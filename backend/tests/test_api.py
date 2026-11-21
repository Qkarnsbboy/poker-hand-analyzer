import copy

from fastapi.testclient import TestClient

import llm
from main import app

# Run with: .venv/bin/python -m pytest -q

# A fake browser that calls the app directly, no server needed.
client = TestClient(app)

from tests.hands import HAND


# The fake Claude, fake database and fake login are set up in conftest.py.


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_analyze_hero_decision():
    r = client.post("/analyze", json={"hand": HAND, "action_index": 9})
    assert r.status_code == 200
    body = r.json()
    assert body["action_index"] == 9
    assert body["recommendation"]["action"] in {"fold", "check", "call", "bet", "raise"}
    assert body["theory"]["villain_range"] == ["Villain's range here."]
    assert body["exploitative"]["adjustment"] == ["Call more."]
    assert "what_would_change_this" not in body


def test_prompt_gets_the_math(fake):
    client.post("/analyze", json={"hand": HAND, "action_index": 9})
    assert "To call: $400" in fake.prompt
    assert "33% equity" in fake.prompt


def test_bet_keeps_sizing(fake):
    fake.answer = fake.answer.model_copy(update={"action": "bet", "sizing": 120})
    r = client.post("/analyze", json={"hand": HAND, "action_index": 6})
    assert r.json()["recommendation"]["sizing"] == 120


def test_sizing_dropped_for_call(fake):
    fake.answer = fake.answer.model_copy(update={"sizing": 400})
    r = client.post("/analyze", json={"hand": HAND, "action_index": 9})
    assert r.json()["recommendation"]["sizing"] is None


def test_reads_dropped_when_hand_has_no_notes():
    no_notes = {**HAND, "notes": ""}
    r = client.post("/analyze", json={"hand": no_notes, "action_index": 9})
    assert r.json()["exploitative"]["reads"] == []


def test_reads_kept_when_hand_has_notes():
    r = client.post("/analyze", json={"hand": HAND, "action_index": 9})
    assert r.json()["exploitative"]["reads"] == ["Villain seems to overbluff."]


def test_prompt_gets_hand_strength(fake):
    client.post("/analyze", json={"hand": HAND, "action_index": 9})
    assert "Hand strength (already calculated, correct):" in fake.prompt
    assert "Straight: 65, A5" in fake.prompt


def test_preflop_board_texture_is_na():
    r = client.post("/analyze", json={"hand": HAND, "action_index": 0})
    assert r.json()["theory"]["board_texture"] == ["N/A"]


def test_no_hand_strength_preflop(fake):
    client.post("/analyze", json={"hand": HAND, "action_index": 0})
    assert "Hand strength" not in fake.prompt


def test_llm_error_is_502(fake):
    fake.error = llm.LLMError("boom")
    r = client.post("/analyze", json={"hand": HAND, "action_index": 9})
    assert r.status_code == 502
    assert r.json()["error"] == {"code": "llm_error", "message": "boom"}


def test_llm_timeout_is_504(fake):
    fake.error = llm.LLMTimeout("Analysis took too long.")
    r = client.post("/analyze", json={"hand": HAND, "action_index": 9})
    assert r.status_code == 504
    assert r.json()["error"]["code"] == "llm_timeout"


def test_villain_action_rejected():
    r = client.post("/analyze", json={"hand": HAND, "action_index": 8})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_request"


def test_out_of_range_rejected():
    r = client.post("/analyze", json={"hand": HAND, "action_index": 10})
    assert r.status_code == 422


def test_malformed_hand_uses_error_shape():
    bad = copy.deepcopy(HAND)
    del bad["hero"]
    r = client.post("/analyze", json={"hand": bad, "action_index": 9})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "invalid_request"
    assert "hero" in r.json()["error"]["message"]
