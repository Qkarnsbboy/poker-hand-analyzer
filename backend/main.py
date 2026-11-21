"""FastAPI app.

/analyze: login -> validate -> saved answer? -> spend cap -> coach.analyze_decision
          (math, hand strength, prompt, Claude) -> record cost + save answer -> response
/hands...: see hands_api.py
"""

import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

import caps
import coach
import llm
import store
from auth import current_user_id
from errors import ApiError, error_response
from hands_api import router as hands_router
from models import AnalyzeRequest, AnalyzeResponse

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

    # Ask Claude. Every call is recorded with its cost, success or not (for the caps).
    try:
        response, call = coach.analyze_decision(hand, i)
    except llm.LLMError as e:
        store.record_llm_call(user_id, hand.id, i, e.call)
        if isinstance(e, llm.LLMTimeout):
            raise ApiError(504, "llm_timeout", str(e))
        raise ApiError(502, "llm_error", str(e))
    store.record_llm_call(user_id, hand.id, i, call)

    # Save it, so next time it is free. (Skipped if the hand is not saved yet.)
    store.save_analysis(user_id, hand.id, i, hand_fingerprint, response.model_dump(mode="json"))
    return response
