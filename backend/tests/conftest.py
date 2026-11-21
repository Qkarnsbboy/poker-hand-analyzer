# Shared test setup. Every test gets a fresh fake database and fake Claude,
# and is "logged in" as TEST_USER unless the test says otherwise.
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import auth  # noqa: E402
import llm  # noqa: E402
import store  # noqa: E402
from main import app  # noqa: E402
from tests.fakes import TEST_USER, FakeClaude, FakeStore  # noqa: E402

STORE_FUNCTIONS = [
    "ensure_profile", "list_hands", "get_hand", "save_hand", "delete_hand", "set_favorite",
    "load_analysis", "save_analysis", "record_llm_call", "month_spend",
]


@pytest.fixture(autouse=True)
def fake_store(monkeypatch):
    fake = FakeStore()
    for name in STORE_FUNCTIONS:
        monkeypatch.setattr(store, name, getattr(fake, name))
    return fake


@pytest.fixture(autouse=True)
def fake(monkeypatch):
    claude = FakeClaude()
    monkeypatch.setattr(llm, "ask_claude", claude)
    return claude


@pytest.fixture(autouse=True)
def logged_in():
    """Pretend TEST_USER is logged in. Tests can change app.dependency_overrides."""
    app.dependency_overrides[auth.current_user_id] = lambda: TEST_USER
    yield
    app.dependency_overrides.clear()
