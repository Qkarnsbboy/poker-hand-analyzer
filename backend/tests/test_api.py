import copy

from fastapi.testclient import TestClient

from main import app

# Run with: .venv/bin/python -m pytest -q

# A fake browser that calls the app directly, no server needed.
client = TestClient(app)

# The "Aces Cracked" sample hand. Hero (BTN) acts at index 0, 2, 4, 6, 9.
HAND = {
    "id": "hand-001",
    "name": "Aces Cracked",
    "game": {"variant": "nlhe", "format": "cash", "sb": 2, "bb": 5, "ante": 0},
    "hero": "BTN",
    "players": [
        {"position": "BTN", "stack": 700, "cards": ["As", "Ah"]},
        {"position": "BB", "stack": 600, "cards": ["Ad", "5c"], "label": "lag"},
    ],
    "board": {"flop": ["Ks", "Jc", "3s"], "turn": "4h", "river": "2d"},
    "actions": [
        {"street": "preflop", "position": "BTN", "action": "raise", "amount": 15},
        {"street": "preflop", "position": "BB", "action": "raise", "amount": 50},
        {"street": "preflop", "position": "BTN", "action": "call", "amount": 50},
        {"street": "flop", "position": "BB", "action": "bet", "amount": 35},
        {"street": "flop", "position": "BTN", "action": "call", "amount": 35},
        {"street": "turn", "position": "BB", "action": "check"},
        {"street": "turn", "position": "BTN", "action": "bet", "amount": 115},
        {"street": "turn", "position": "BB", "action": "call", "amount": 115},
        {"street": "river", "position": "BB", "action": "bet", "amount": 400},
        {"street": "river", "position": "BTN", "action": "call", "amount": 400},
    ],
    "notes": "Villain is loose.",
}


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_analyze_hero_decision():
    r = client.post("/analyze", json={"hand": HAND, "action_index": 9})
    assert r.status_code == 200
    body = r.json()
    assert body["action_index"] == 9
    assert body["recommendation"]["action"] in {"fold", "check", "call", "bet", "raise"}
    assert 2 <= len(body["theory"]) <= 4


def test_bet_placeholder_has_sizing():
    r = client.post("/analyze", json={"hand": HAND, "action_index": 6})
    assert r.json()["recommendation"]["sizing"] == 115


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
