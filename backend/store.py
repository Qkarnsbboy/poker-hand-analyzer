"""Everything the backend reads or writes in the database. See migrations/001_initial.sql.

Every function takes the user's id and only touches that user's rows.
Tests swap this module's functions for an in-memory fake, so they never need a database.
"""

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from models import Hand

SAMPLE_HANDS_FILE = Path(__file__).parent / "sample_hands.json"

_pool: Optional[ConnectionPool] = None


def pool() -> ConnectionPool:
    """A few open database connections, reused across requests. Opened on first use."""
    global _pool
    if _pool is None:
        _pool = ConnectionPool(os.environ["DATABASE_URL"], min_size=1, max_size=5, open=True)
    return _pool


# ----- Hand versions -----


def fingerprint(hand: Hand) -> str:
    """A short id for this exact version of the hand. Any change except the name changes it.

    Saved answers remember the fingerprint they were made for, so an edited hand
    gets fresh answers.
    """
    content = hand.model_dump(mode="json", exclude={"name"})
    text = json.dumps(content, sort_keys=True)
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def hand_json(hand: Hand) -> dict:
    """The hand as stored: the same shape the frontend sent (keys it left out stay out)."""
    return hand.model_dump(mode="json", exclude_unset=True)


# ----- Profiles and sample hands -----


def ensure_profile(user_id: str) -> None:
    """First request from a user: make their profile and give them the sample hands."""
    with pool().connection() as conn:
        row = conn.execute("select samples_added from profiles where user_id = %s", (user_id,)).fetchone()
        if row and row[0]:
            return  # already set up

        if row is None:
            conn.execute("insert into profiles (user_id) values (%s) on conflict do nothing", (user_id,))

        samples = json.loads(SAMPLE_HANDS_FILE.read_text())
        for sample in samples:
            conn.execute(
                """
                insert into hands (user_id, hand_id, hand) values (%s, %s, %s)
                on conflict (user_id, hand_id) do nothing
                """,
                (user_id, sample["id"], Jsonb(sample)),
            )
        conn.execute("update profiles set samples_added = true where user_id = %s", (user_id,))


# ----- Hands -----


def list_hands(user_id: str) -> list[dict]:
    """The user's hands, newest first: [{"hand": {...}, "favorite": bool, "created_at": "2026-11-21T..."}]"""
    with pool().connection() as conn:
        rows = conn.execute(
            "select hand, favorite, created_at from hands where user_id = %s order by created_at desc, hand_id",
            (user_id,),
        ).fetchall()
    result = []
    for hand, favorite, created_at in rows:
        result.append({"hand": hand, "favorite": favorite, "created_at": created_at.isoformat()})
    return result


def get_hand(user_id: str, hand_id: str) -> Optional[dict]:
    """One saved hand as {"hand": {...}, "favorite": bool}, or None."""
    with pool().connection() as conn:
        row = conn.execute(
            "select hand, favorite from hands where user_id = %s and hand_id = %s",
            (user_id, hand_id),
        ).fetchone()
    if row is None:
        return None
    return {"hand": row[0], "favorite": row[1]}


def save_hand(user_id: str, hand: Hand) -> dict:
    """Create the hand, or replace it if it exists. The favorite flag is kept."""
    with pool().connection() as conn:
        row = conn.execute(
            """
            insert into hands (user_id, hand_id, hand) values (%s, %s, %s)
            on conflict (user_id, hand_id)
                do update set hand = excluded.hand, updated_at = now()
            returning hand, favorite, created_at
            """,
            (user_id, hand.id, Jsonb(hand_json(hand))),
        ).fetchone()
    return {"hand": row[0], "favorite": row[1], "created_at": row[2].isoformat()}


def delete_hand(user_id: str, hand_id: str) -> bool:
    """True if a hand was deleted. Its saved analysis goes with it (on delete cascade)."""
    with pool().connection() as conn:
        result = conn.execute("delete from hands where user_id = %s and hand_id = %s", (user_id, hand_id))
        return result.rowcount > 0


def set_favorite(user_id: str, hand_id: str, favorite: bool) -> bool:
    """True if the hand exists (and was updated)."""
    with pool().connection() as conn:
        result = conn.execute(
            "update hands set favorite = %s where user_id = %s and hand_id = %s",
            (favorite, user_id, hand_id),
        )
        return result.rowcount > 0


# ----- Saved analysis -----


def load_analysis(user_id: str, hand_id: str, hand_fingerprint: str) -> dict[int, dict]:
    """Saved answers for this version of the hand: {action_index: answer}."""
    with pool().connection() as conn:
        rows = conn.execute(
            """
            select action_index, result from analysis
            where user_id = %s and hand_id = %s and fingerprint = %s
            """,
            (user_id, hand_id, hand_fingerprint),
        ).fetchall()
    answers = {}
    for action_index, result in rows:
        answers[action_index] = result
    return answers


def save_analysis(user_id: str, hand_id: str, action_index: int, hand_fingerprint: str, result: dict) -> None:
    """Save (or replace) one answer. Skipped if the hand is not saved for this user."""
    with pool().connection() as conn:
        conn.execute(
            """
            insert into analysis (user_id, hand_id, action_index, fingerprint, result)
            select %s, %s, %s, %s, %s
            where exists (select 1 from hands where user_id = %s and hand_id = %s)
            on conflict (user_id, hand_id, action_index)
                do update set fingerprint = excluded.fingerprint, result = excluded.result, created_at = now()
            """,
            (user_id, hand_id, action_index, hand_fingerprint, Jsonb(result), user_id, hand_id),
        )


# ----- Claude calls (for spend caps) -----


def record_llm_call(user_id: str, hand_id: str, action_index: int, call: dict) -> None:
    """One row per Claude call, success or not. `call` comes from llm.ask_claude."""
    with pool().connection() as conn:
        conn.execute(
            """
            insert into llm_calls
                (user_id, hand_id, action_index, model, status, input_tokens, output_tokens, cost_usd, seconds)
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user_id,
                hand_id,
                action_index,
                call["model"],
                call["status"],
                call.get("input_tokens", 0),
                call.get("output_tokens", 0),
                call.get("cost_usd", 0),
                call.get("seconds"),
            ),
        )


def month_start() -> datetime:
    """Midnight UTC on the 1st of this month. Caps reset then."""
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def month_spend(user_id: Optional[str] = None) -> float:
    """Dollars spent on Claude this month: by one user, or by everyone if user_id is None."""
    with pool().connection() as conn:
        if user_id is None:
            row = conn.execute(
                "select coalesce(sum(cost_usd), 0) from llm_calls where created_at >= %s",
                (month_start(),),
            ).fetchone()
        else:
            row = conn.execute(
                "select coalesce(sum(cost_usd), 0) from llm_calls where user_id = %s and created_at >= %s",
                (user_id, month_start()),
            ).fetchone()
    return float(row[0])
