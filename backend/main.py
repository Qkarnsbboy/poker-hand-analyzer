"""FastAPI app. Skeleton: /analyze validates the request and returns placeholder analysis until the LLM is wired in."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from models import AnalyzeRequest, AnalyzeResponse, Recommendation

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

    # PLACEHOLDER: this is where the Claude call will go.
    # For now, just recommend whatever hero actually did.
    taken = actions[i]
    sizing = getattr(taken, "amount", None) if taken.action in ("bet", "raise") else None
    return AnalyzeResponse(
        action_index=i,
        recommendation=Recommendation(action=taken.action, sizing=sizing, confidence="low"),
        theory=[
            "Placeholder from the backend skeleton.",
            "Real theory reasoning arrives once the LLM is wired in.",
        ],
        exploitative=[
            "Placeholder from the backend skeleton.",
            "Real exploitative reasoning will use villain type and notes.",
        ],
        what_would_change_this="Placeholder.",
    )
