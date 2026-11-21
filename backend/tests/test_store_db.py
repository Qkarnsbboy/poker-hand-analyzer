# Tests store.py's real SQL against the real database. Everything runs inside one
# transaction that is ROLLED BACK at the end, so nothing is left behind.
#
# Skipped by default (it needs DATABASE_URL and network). Run with:
#   RUN_DB_TESTS=1 .venv/bin/python -m pytest -q tests/test_store_db.py

import os
import uuid
from contextlib import contextmanager
from pathlib import Path

import psycopg
import pytest
from dotenv import dotenv_values

import store as real_store
from models import Hand
from tests.hands import HAND

pytestmark = pytest.mark.skipif(os.environ.get("RUN_DB_TESTS") != "1", reason="set RUN_DB_TESTS=1 to run")


class OneConnectionPool:
    """Hands every store function the same connection, so one rollback undoes everything."""

    def __init__(self, conn):
        self.conn = conn

    @contextmanager
    def connection(self):
        yield self.conn


@pytest.fixture
def db(monkeypatch):
    # conftest.py swaps store functions for fakes; put the real ones back for this file.
    import importlib

    real = importlib.reload(real_store)
    url = dotenv_values(Path(__file__).parent.parent / ".env")["DATABASE_URL"]
    conn = psycopg.connect(url)
    monkeypatch.setattr(real, "pool", lambda: OneConnectionPool(conn))

    # A throwaway user, only inside this transaction.
    user_id = str(uuid.uuid4())
    conn.execute("insert into auth.users (id, email) values (%s, %s)", (user_id, f"test-{user_id}@example.com"))
    try:
        yield real, user_id
    finally:
        conn.rollback()  # undo everything this test did
        conn.close()


def test_store_round_trip(db):
    store, user = db
    hand = Hand.model_validate(HAND)

    # First visit adds the 3 sample hands, once.
    store.ensure_profile(user)
    store.ensure_profile(user)
    assert len(store.list_hands(user)) == 3

    # Save (replaces the sample with the same id), favorite, read back.
    store.save_hand(user, hand)
    assert store.set_favorite(user, hand.id, True)
    saved = store.get_hand(user, hand.id)
    assert saved["favorite"] is True
    assert saved["hand"]["notes"] == HAND["notes"]

    # Save an answer, load it for the same version, not for another version.
    fp = store.fingerprint(hand)
    store.save_analysis(user, hand.id, 9, fp, {"action_index": 9})
    assert store.load_analysis(user, hand.id, fp) == {9: {"action_index": 9}}
    assert store.load_analysis(user, hand.id, "other-version") == {}

    # Cost tracking.
    store.record_llm_call(user, hand.id, 9, {"model": "m", "status": "ok", "cost_usd": 0.25, "seconds": 1.0})
    assert store.month_spend(user) == pytest.approx(0.25)
    assert store.month_spend() >= 0.25

    # Delete removes the hand and its answers.
    assert store.delete_hand(user, hand.id)
    assert store.load_analysis(user, hand.id, fp) == {}
    assert not store.delete_hand(user, hand.id)
