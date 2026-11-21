"""Monthly spend caps on Claude, so friends (or a bug) cannot run up the bill.

    per user:  USER_MONTHLY_CAP_USD   (default $2)
    everyone:  TOTAL_MONTHLY_CAP_USD  (default $20)

Spend comes from the llm_calls table. Caps reset on the 1st of each month (UTC).
Checked before each Claude call. Saved answers are free, so they are never blocked.
"""

import os

import store
from errors import ApiError

DEFAULT_USER_CAP = 2.0
DEFAULT_TOTAL_CAP = 20.0


def user_cap() -> float:
    return float(os.environ.get("USER_MONTHLY_CAP_USD", DEFAULT_USER_CAP))


def total_cap() -> float:
    return float(os.environ.get("TOTAL_MONTHLY_CAP_USD", DEFAULT_TOTAL_CAP))


def check_caps(user_id: str) -> None:
    """Raise 429 usage_limit if this user, or the whole app, is at its cap this month."""
    if store.month_spend(user_id) >= user_cap():
        raise ApiError(429, "usage_limit", "You reached your monthly analysis limit. It resets on the 1st.")
    if store.month_spend() >= total_cap():
        raise ApiError(429, "usage_limit", "The app reached its monthly analysis limit. It resets on the 1st.")


def usage(user_id: str) -> dict:
    """What GET /usage returns."""
    return {
        "month_spend_usd": round(store.month_spend(user_id), 4),
        "user_cap_usd": user_cap(),
        "total_cap_usd": total_cap(),
    }
