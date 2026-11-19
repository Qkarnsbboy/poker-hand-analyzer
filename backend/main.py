"""FastAPI app. /analyze: validate -> poker math -> prompt -> Claude -> response."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

import llm
from models import AnalyzeRequest, AnalyzeResponse, Recommendation
from poker_math import decision_math
from prompt import SYSTEM_PROMPT, build_prompt

# The app object. uvicorn runs this ("main:app").
app = FastAPI(title="Poker Hand Analyzer")


# Every error goes out in the same shape: {"error": {"code": ..., "message": ...}}
def error(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


# FastAPI checks requests against models.py automatically.
# When a request doesn't match, this turns FastAPI's default error into our shape.
@app.exception_handler(RequestValidationError)
async def on_invalid(_: Request, exc: RequestValidationError) -> JSONResponse:
    # Report only the first problem, e.g. "hand.hero: Field required"
    first = exc.errors()[0]
    where = ".".join(str(p) for p in first["loc"] if p != "body")
    return error(422, "invalid_request", f"{where}: {first['msg']}")


# Quick "is the backend up?" check.
@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


# The main endpoint: give it a hand and which action, get a recommendation back.
# By the time this runs, FastAPI has already checked the request shape.
@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    actions = req.hand.actions
    i = req.action_index

    # The index must point at a real action...
    if not 0 <= i < len(actions):
        return error(422, "invalid_request", f"action_index {i} is out of range.")
    # ...and it must be hero's turn (we only analyze hero decisions).
    if actions[i].position != req.hand.hero:
        return error(422, "invalid_request", f"action_index {i} is not a hero decision.")

    # 1. Work out the numbers.
    math = decision_math(req.hand, i)
    # 2. Write the question.
    question = build_prompt(req.hand, i, math)
    # 3. Ask Claude. Errors map to the contract's status codes.
    try:
        answer = llm.ask_claude(SYSTEM_PROMPT, question)
    except llm.LLMTimeout as e:
        return error(504, "llm_timeout", str(e))
    except llm.LLMError as e:
        return error(502, "llm_error", str(e))

    # 4. Tidy up and send back. Sizing only makes sense for bet/raise.
    sizing = answer.sizing if answer.action in ("bet", "raise") else None
    if len(answer.theory) < 2 or len(answer.exploitative) < 2:
        return error(502, "llm_error", "Claude's answer was missing reasoning.")
    return AnalyzeResponse(
        action_index=i,
        recommendation=Recommendation(action=answer.action, sizing=sizing, confidence=answer.confidence),
        theory=answer.theory[:4],
        exploitative=answer.exploitative[:4],
        what_would_change_this=answer.what_would_change_this,
    )
