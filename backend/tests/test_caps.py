# Monthly spend caps. Uses the fake database and fake Claude (conftest.py).

from fastapi.testclient import TestClient

import auth
from main import app
from tests.fakes import OTHER_USER
from tests.hands import HAND

client = TestClient(app)


def analyze(index=9, hand=HAND):
    return client.post("/analyze", json={"hand": hand, "action_index": index})


def test_under_the_cap_works(monkeypatch):
    monkeypatch.setenv("USER_MONTHLY_CAP_USD", "1.00")
    assert analyze().status_code == 200


def test_over_the_user_cap_is_429(monkeypatch, fake):
    monkeypatch.setenv("USER_MONTHLY_CAP_USD", "0.01")
    fake.cost = 0.02
    assert analyze(9).status_code == 200  # this call goes over the cap...
    r = analyze(6)  # ...so the next one is blocked
    assert r.status_code == 429
    assert r.json()["error"]["code"] == "usage_limit"
    assert fake.calls == 1  # Claude was not called


def test_user_cap_is_per_user(monkeypatch, fake):
    monkeypatch.setenv("USER_MONTHLY_CAP_USD", "0.01")
    fake.cost = 0.02
    analyze(9)
    app.dependency_overrides[auth.current_user_id] = lambda: OTHER_USER
    assert analyze(9).status_code == 200  # a different user still has budget


def test_total_cap_blocks_everyone(monkeypatch, fake):
    monkeypatch.setenv("TOTAL_MONTHLY_CAP_USD", "0.01")
    fake.cost = 0.02
    analyze(9)
    app.dependency_overrides[auth.current_user_id] = lambda: OTHER_USER
    assert analyze(9).status_code == 429


def test_saved_answers_still_work_over_the_cap(monkeypatch, fake):
    monkeypatch.setenv("USER_MONTHLY_CAP_USD", "0.01")
    fake.cost = 0.02
    client.put(f"/hands/{HAND['id']}", json=HAND)
    analyze(9)
    assert analyze(9).status_code == 200  # saved answer, free


def test_usage_endpoint(monkeypatch, fake):
    monkeypatch.setenv("USER_MONTHLY_CAP_USD", "2")
    analyze(9)
    body = client.get("/usage").json()
    assert body == {"month_spend_usd": 0.007, "user_cap_usd": 2.0, "total_cap_usd": 20.0}
