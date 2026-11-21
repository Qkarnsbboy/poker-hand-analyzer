# Login, saved hands, and saved answers. Uses the fake database and fake Claude (conftest.py).

import copy
import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

import auth
import llm
from main import app
from tests.fakes import OTHER_USER, TEST_USER
from tests.hands import HAND

client = TestClient(app)


def analyze(hand, index):
    return client.post("/analyze", json={"hand": hand, "action_index": index})


# ----- Login -----


class FakeKeyClient:
    """Stands in for Supabase's public-key download."""

    def __init__(self, public_key):
        self.public_key = public_key

    def get_signing_key_from_jwt(self, token):
        return jwt.PyJWK.from_dict(jwt.algorithms.ECAlgorithm.to_jwk(self.public_key, as_dict=True), algorithm="ES256")


@pytest.fixture
def real_login(monkeypatch):
    """Use the real token check, with a test key pair instead of Supabase's."""
    app.dependency_overrides.clear()
    private_key = ec.generate_private_key(ec.SECP256R1())
    monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setattr(auth, "key_client", lambda: FakeKeyClient(private_key.public_key()))

    def make_token(user_id=TEST_USER, expires_in=3600, audience="authenticated", key=private_key):
        claims = {
            "sub": user_id,
            "aud": audience,
            "iss": "https://test.supabase.co/auth/v1",
            "exp": int(time.time()) + expires_in,
        }
        return jwt.encode(claims, key, algorithm="ES256")

    return make_token


def test_no_token_is_401():
    app.dependency_overrides.clear()
    r = client.get("/hands")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"


def test_valid_token_works(real_login):
    r = client.get("/hands", headers={"Authorization": f"Bearer {real_login()}"})
    assert r.status_code == 200


def test_expired_token_is_401(real_login):
    r = client.get("/hands", headers={"Authorization": f"Bearer {real_login(expires_in=-10)}"})
    assert r.status_code == 401
    assert "expired" in r.json()["error"]["message"]


def test_token_signed_by_someone_else_is_401(real_login):
    stranger_key = ec.generate_private_key(ec.SECP256R1())
    r = client.get("/hands", headers={"Authorization": f"Bearer {real_login(key=stranger_key)}"})
    assert r.status_code == 401


def test_token_for_wrong_audience_is_401(real_login):
    r = client.get("/hands", headers={"Authorization": f"Bearer {real_login(audience='anon')}"})
    assert r.status_code == 401


def test_health_needs_no_login():
    app.dependency_overrides.clear()
    assert client.get("/health").status_code == 200


# ----- Hands -----


def test_first_visit_sets_up_the_profile(fake_store):
    client.get("/hands")
    assert TEST_USER in fake_store.profiles


def test_save_list_and_delete_a_hand():
    assert client.put(f"/hands/{HAND['id']}", json=HAND).status_code == 200
    hands = client.get("/hands").json()["hands"]
    assert [h["hand"]["id"] for h in hands] == [HAND["id"]]
    assert client.delete(f"/hands/{HAND['id']}").status_code == 204
    assert client.get("/hands").json()["hands"] == []


def test_hand_id_must_match_url():
    r = client.put("/hands/some-other-id", json=HAND)
    assert r.status_code == 422


def test_favorite():
    client.put(f"/hands/{HAND['id']}", json=HAND)
    assert client.put(f"/hands/{HAND['id']}/favorite", json={"favorite": True}).json() == {"favorite": True}
    assert client.get("/hands").json()["hands"][0]["favorite"] is True
    # Saving an edit keeps the star.
    client.put(f"/hands/{HAND['id']}", json={**HAND, "notes": "edited"})
    assert client.get("/hands").json()["hands"][0]["favorite"] is True


def test_missing_hand_is_404():
    assert client.put("/hands/nope/favorite", json={"favorite": True}).status_code == 404
    assert client.delete("/hands/nope").status_code == 404
    assert client.get("/hands/nope/analysis").status_code == 404


def test_users_only_see_their_own_hands():
    client.put(f"/hands/{HAND['id']}", json=HAND)
    app.dependency_overrides[auth.current_user_id] = lambda: OTHER_USER
    assert client.get("/hands").json()["hands"] == []
    assert client.delete(f"/hands/{HAND['id']}").status_code == 404


# ----- Saved answers -----


def test_answer_is_saved_and_reused(fake):
    client.put(f"/hands/{HAND['id']}", json=HAND)
    first = analyze(HAND, 9).json()
    second = analyze(HAND, 9).json()
    assert first == second
    assert fake.calls == 1  # the second time was free


def test_saved_answers_endpoint():
    client.put(f"/hands/{HAND['id']}", json=HAND)
    analyze(HAND, 9)
    results = client.get(f"/hands/{HAND['id']}/analysis").json()["results"]
    assert list(results) == ["9"]
    assert results["9"]["recommendation"]["action"] == "call"


def test_editing_the_hand_reruns_analysis(fake):
    client.put(f"/hands/{HAND['id']}", json=HAND)
    analyze(HAND, 9)
    edited = copy.deepcopy(HAND)
    edited["notes"] = "Villain is a nit."
    client.put(f"/hands/{HAND['id']}", json=edited)
    # The old answer is for the old version, so it is not returned...
    assert client.get(f"/hands/{HAND['id']}/analysis").json()["results"] == {}
    # ...and analyzing again calls Claude.
    analyze(edited, 9)
    assert fake.calls == 2


def test_renaming_keeps_answers(fake):
    client.put(f"/hands/{HAND['id']}", json=HAND)
    analyze(HAND, 9)
    analyze({**HAND, "name": "New name"}, 9)
    assert fake.calls == 1


def test_unsaved_hand_still_analyzes_but_is_not_saved(fake_store):
    r = analyze(HAND, 9)
    assert r.status_code == 200
    assert fake_store.analysis == {}


def test_every_call_is_recorded_with_cost(fake_store):
    analyze(HAND, 9)
    assert len(fake_store.calls) == 1
    assert fake_store.calls[0]["user_id"] == TEST_USER
    assert fake_store.calls[0]["cost_usd"] == 0.007


def test_failed_call_is_recorded_too(fake, fake_store):
    fake.error = llm.LLMError("boom")
    assert analyze(HAND, 9).status_code == 502
    assert fake_store.calls[0]["status"] == "error"


def test_deleting_a_hand_deletes_its_answers(fake_store):
    client.put(f"/hands/{HAND['id']}", json=HAND)
    analyze(HAND, 9)
    client.delete(f"/hands/{HAND['id']}")
    assert fake_store.analysis == {}
