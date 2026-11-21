"""Request and response shapes. Hand mirrors docs/data-model.json; the rest mirrors docs/api-contract.md."""

from typing import Literal, Optional, Union

from pydantic import BaseModel, Field

# Pydantic models = the allowed shape of the JSON.
# If a request doesn't fit these, FastAPI rejects it before our code runs.

# Literal means "must be one of these exact values".
Position = Literal["SB", "BB", "UTG", "HJ", "CO", "BTN"]
Street = Literal["preflop", "flop", "turn", "river"]
Card = str
PlayerLabel = Literal["fish", "station", "nit", "tag", "lag", "maniac"]


# ----- The hand (same shape as docs/data-model.json) -----


class Game(BaseModel):
    variant: Literal["nlhe"]
    format: Literal["cash"]
    sb: float
    bb: float
    ante: float


class Player(BaseModel):
    position: Position
    stack: float
    cards: Optional[list[Card]] = Field(min_length=2, max_length=2)  # null = unknown
    label: Optional[PlayerLabel] = None  # villain's player type; hero doesn't have one


class Board(BaseModel):
    flop: Optional[list[Card]] = Field(min_length=3, max_length=3)
    turn: Optional[Card]
    river: Optional[Card]


# Two kinds of action: fold/check have no amount, call/bet/raise do.
class PassiveAction(BaseModel):
    street: Street
    position: Position
    action: Literal["fold", "check"]


class SizedAction(BaseModel):
    street: Street
    position: Position
    action: Literal["call", "bet", "raise"]
    amount: float  # total for the street, not the increment


class Hand(BaseModel):
    id: str
    name: str
    game: Game
    hero: Position
    players: list[Player]
    board: Board
    actions: list[Union[SizedAction, PassiveAction]]
    notes: str


# ----- POST /analyze (same shape as docs/api-contract.md) -----


# What the frontend sends.
class AnalyzeRequest(BaseModel):
    hand: Hand
    action_index: int  # which action in hand.actions to analyze


class Recommendation(BaseModel):
    action: Literal["fold", "check", "call", "bet", "raise"]
    sizing: Optional[float]  # only for bet/raise, otherwise null
    confidence: Literal["high", "medium", "low"]


# Theory, split into four buckets. Each bucket is a list of short bullets.
class Theory(BaseModel):
    hero_range: list[str]  # Hero's range here, and where Hero's hand fits in it
    villain_range: list[str]  # the hands Villain can have, given the action
    board_texture: list[str]  # how the board changes things
    bet_sizing: list[str]  # pot odds, SPR, sizing


# Exploitative, split into four buckets. Each bucket is a list of short bullets.
class Exploitative(BaseModel):
    theory_baseline: list[str]  # the default play, simply
    player_type: list[str]  # how this type (or the typical player) deviates from theory
    reads: list[str]  # what the notes tell us; empty when there are no notes
    adjustment: list[str]  # the recommended play, given everything


# What the backend sends back.
class AnalyzeResponse(BaseModel):
    action_index: int  # echoed back so the frontend can ignore old answers
    recommendation: Recommendation
    theory: Theory
    exploitative: Exploitative
