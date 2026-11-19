"""The only file that talks to Claude. Everything else stays testable without it."""

import json
import os
import time
from datetime import datetime
from typing import Literal, Optional

import anthropic
from dotenv import load_dotenv
from pydantic import BaseModel, ValidationError

# Read ANTHROPIC_API_KEY and ANTHROPIC_MODEL from backend/.env
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

TIMEOUT_SECONDS = 30  # from the API contract

# Every Claude call is appended here in a readable format. Git ignores this folder.
LOG_FILE = os.path.join(os.path.dirname(__file__), "logs", "analyze.log")

# Sonnet 5.5 price per million tokens, for the rough cost in the log.
PRICE_IN, PRICE_OUT = 2.00, 10.00


def pretty(raw: str) -> str:
    """Claude's JSON, one field per line. Falls back to the raw text if it isn't valid JSON."""
    try:
        return json.dumps(json.loads(raw), indent=2)
    except (ValueError, TypeError):
        return raw


def log_call(entry: dict) -> None:
    """Write one readable block per call to the terminal and to LOG_FILE."""
    lines = [
        "=" * 72,
        f"Claude call  {entry['time']}  {entry['seconds']}s  {entry['status'].upper()}  model={entry['model']}",
        "=" * 72,
        "",
        "PROMPT:",
        entry["prompt"],
        "",
    ]
    if entry.get("raw_text"):
        lines += ["RESPONSE:", pretty(entry["raw_text"]), ""]
    if entry.get("error"):
        lines += [f"ERROR: {entry['error']}", ""]
    if entry.get("usage"):
        u = entry["usage"]
        lines.append(
            f"USAGE: {u['input_tokens']} in / {u['output_tokens']} out  ~${u['cost_usd']:.4f}  "
            f"stop={entry.get('stop_reason')}  request_id={entry.get('request_id')}"
        )
    text = "\n".join(lines) + "\n\n"

    os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
    with open(LOG_FILE, "a") as f:
        f.write(text)
    print(text, flush=True)


class LLMError(Exception):
    """Claude failed or gave something unusable. -> 502"""


class LLMTimeout(LLMError):
    """Claude took longer than 30 seconds. -> 504"""


# The exact shape Claude must answer in. The API enforces it (structured outputs).
class LLMAnalysis(BaseModel):
    action: Literal["fold", "check", "call", "bet", "raise"]
    sizing: Optional[float]
    confidence: Literal["high", "medium", "low"]
    theory: list[str]
    exploitative: list[str]
    what_would_change_this: str


_client: Optional[anthropic.Anthropic] = None


def client() -> anthropic.Anthropic:
    """Created on first use, so a missing key only matters when we actually call Claude."""
    global _client
    if _client is None:
        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise LLMError("ANTHROPIC_API_KEY is not set in backend/.env.")
        # No automatic retries: one try, 30s max, per the contract.
        _client = anthropic.Anthropic(timeout=TIMEOUT_SECONDS, max_retries=0)
    return _client


def ask_claude(system: str, user: str) -> LLMAnalysis:
    """Send the prompt, get back a validated LLMAnalysis. Every call is logged, success or not."""
    model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5-5")
    started = time.time()
    entry = {"time": datetime.now().isoformat(timespec="seconds"), "model": model, "prompt": user, "status": "crash"}

    try:
        result = _call(model, system, user, entry)
        entry["status"] = "ok"
        return result
    except LLMError as e:
        entry["status"] = "timeout" if isinstance(e, LLMTimeout) else "error"
        entry["error"] = str(e)
        raise
    finally:
        entry["seconds"] = round(time.time() - started, 1)
        log_call(entry)


def _call(model: str, system: str, user: str, entry: dict) -> LLMAnalysis:
    """The actual request. Fills `entry` with what came back so it can be logged."""
    try:
        response = client().beta.messages.parse(
            model=model,
            max_tokens=16000,
            system=system,
            messages=[{"role": "user", "content": user}],
            output_format=LLMAnalysis,  # forces the JSON shape above
            output_config={"effort": "medium"},  # enough thinking, still fast
            # If a safety filter declines, the API retries on another model by itself.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except anthropic.APITimeoutError as e:
        raise LLMTimeout("Analysis took too long.") from e
    except anthropic.AuthenticationError as e:
        raise LLMError("The Anthropic API key was rejected.") from e
    except anthropic.RateLimitError as e:
        raise LLMError("Rate limited by the Anthropic API. Try again shortly.") from e
    except anthropic.APIStatusError as e:
        raise LLMError(f"Anthropic API error ({e.status_code}).") from e
    except anthropic.APIConnectionError as e:
        raise LLMError("Couldn't reach the Anthropic API.") from e
    except ValidationError as e:
        raise LLMError("Claude's answer didn't match the expected shape.") from e

    # Record exactly what Claude sent back, before any checks.
    entry["request_id"] = response._request_id
    entry["served_by"] = response.model
    entry["stop_reason"] = response.stop_reason
    entry["raw_text"] = "".join(b.text for b in response.content if b.type == "text")
    u = response.usage
    entry["usage"] = {
        "input_tokens": u.input_tokens,
        "output_tokens": u.output_tokens,  # includes hidden thinking
        "cost_usd": round((u.input_tokens * PRICE_IN + u.output_tokens * PRICE_OUT) / 1e6, 5),
    }

    # Check why it stopped before trusting the content.
    if response.stop_reason == "refusal":
        raise LLMError("Claude declined to analyze this spot.")
    if response.stop_reason == "max_tokens" or response.parsed_output is None:
        raise LLMError("Claude's answer was cut off or unreadable.")
    return response.parsed_output
