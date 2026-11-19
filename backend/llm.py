"""The only file that talks to Claude. Everything else stays testable without it."""

import os
from typing import Literal, Optional

import anthropic
from dotenv import load_dotenv
from pydantic import BaseModel

# Read ANTHROPIC_API_KEY and ANTHROPIC_MODEL from backend/.env
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

TIMEOUT_SECONDS = 30  # from the API contract


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
    """Send the prompt, get back a validated LLMAnalysis."""
    try:
        response = client().beta.messages.parse(
            model=os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5-5"),
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

    # Check why it stopped before trusting the content.
    if response.stop_reason == "refusal":
        raise LLMError("Claude declined to analyze this spot.")
    if response.stop_reason == "max_tokens" or response.parsed_output is None:
        raise LLMError("Claude's answer was cut off or unreadable.")
    return response.parsed_output
