"""FastAPI app.

/analyze: login -> validate -> saved answer? -> poker math -> hand strength -> prompt
          -> Claude -> save answer + record cost -> response
/hands...: see hands_api.py
"""

import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

import caps
import llm
import store
from auth import current_user_id
from errors import ApiError, error_response
from hands_api import router as hands_router
from models import AnalyzeRequest, AnalyzeResponse, Recommendation
from poker_math import decision_math
from hand_strength import hand_strength
from prompt import SYSTEM_PROMPT, board_through, build_prompt

# Read SUPABASE_URL, DATABASE_URL, ANTHROPIC_API_KEY... from backend/.env
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# The app object. uvicorn runs this ("main:app").
app = FastAPI(title="Poker Hand Analyzer")
app.include_router(hands_router)


# Any ApiError raised in a request becomes our error shape.
@app.exception_handler(ApiError)
async def on_api_error(_: Request, exc: ApiError) -> JSONResponse:
    return error_response(exc.status, exc.code, exc.message)


# FastAPI checks requests against models.py automatically.
# When a request doesn't match, this turns FastAPI's default error into our shape.
@app.exception_handler(RequestValidationError)
async def on_invalid(_: Request, exc: RequestValidationError) -> JSONResponse:
    # Report only the first problem, e.g. "hand.hero: Field required"
    first = exc.errors()[0]
    where = ".".join(str(p) for p in first["loc"] if p != "body")
    return error_response(422, "invalid_request", f"{where}: {first['msg']}")


# Quick "is the backend up?" check.
@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


# This month's Claude spend for the user, and the caps.
@app.get("/usage")
def usage(user_id: str = Depends(current_user_id)) -> dict:
    return caps.usage(user_id)


# The main endpoint: give it a hand and which action, get a recommendation back.
# By the time this runs, FastAPI has already checked the request shape.
@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest, user_id: str = Depends(current_user_id)):
    hand = req.hand
    actions = hand.actions
    i = req.action_index

    # The index must point at a real action...
    if not 0 <= i < len(actions):
        raise ApiError(422, "invalid_request", f"action_index {i} is out of range.")
    # ...and it must be hero's turn (we only analyze hero decisions).
    if actions[i].position != hand.hero:
        raise ApiError(422, "invalid_request", f"action_index {i} is not a hero decision.")

    # 0. Already answered for this exact version of the hand? Return it: no Claude call, no cost.
    hand_fingerprint = store.fingerprint(hand)
    saved = store.load_analysis(user_id, hand.id, hand_fingerprint).get(i)
    if saved is not None:
        return AnalyzeResponse.model_validate(saved)

    # Over a monthly spend cap? Stop before calling Claude.
    caps.check_caps(user_id)

    # 1. Work out the numbers.
    math = decision_math(hand, i)
    # 2. Work out what Hero has and which hands beat it (on the board shown so far).
    hero = next(p for p in hand.players if p.position == hand.hero)
    board = board_through(hand, math.street)
    strength = hand_strength(hero.cards, board) if hero.cards else None
    # 3. Write the question.
    question = build_prompt(hand, i, math, strength)
    # 4. Ask Claude. Errors map to the contract's status codes.
    # Every call is recorded with its cost, success or not (for the spend caps).
    try:
        answer, call = llm.ask_claude(SYSTEM_PROMPT, question)
    except llm.LLMError as e:
        store.record_llm_call(user_id, hand.id, i, e.call)
        if isinstance(e, llm.LLMTimeout):
            raise ApiError(504, "llm_timeout", str(e))
        raise ApiError(502, "llm_error", str(e))
    store.record_llm_call(user_id, hand.id, i, call)

    # 5. Tidy up and send back.
    # Sizing only makes sense for bet or raise.
    if answer.action in ("bet", "raise"):
        sizing = answer.sizing
    else:
        sizing = None

    # Preflop there is no board to describe.
    theory = answer.theory
    if math.street == "preflop":
        theory = theory.model_copy(update={"board_texture": ["N/A"]})

    # No notes means there is nothing to read from them.
    exploitative = answer.exploitative
    if not hand.notes.strip():
        exploitative = exploitative.model_copy(update={"reads": []})

    response = AnalyzeResponse(
        action_index=i,
        recommendation=Recommendation(action=answer.action, sizing=sizing, confidence=answer.confidence),
        theory=theory,
        exploitative=exploitative,
    )

    # 6. Save it, so next time it is free. (Skipped if the hand is not saved yet.)
    store.save_analysis(user_id, hand.id, i, hand_fingerprint, response.model_dump(mode="json"))
    return response
