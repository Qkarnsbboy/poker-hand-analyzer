import copy

from fastapi.testclient import TestClient

from main import app

# Run with: .venv/bin/python -m pytest -q

# A fake browser that calls the app directly, no server needed.
client = TestClient(app)

from tests.hands import HAND


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
