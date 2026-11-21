"""Endpoints for the user's saved hands, favorites and saved answers. All need a login.

    GET    /hands                       list (adds the sample hands on first use)
    PUT    /hands/{hand_id}             create or replace
    DELETE /hands/{hand_id}             delete (and its answers)
    PUT    /hands/{hand_id}/favorite    set or clear the star
    GET    /hands/{hand_id}/analysis    saved answers for the hand's current version
"""

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel

import store
from auth import current_user_id
from errors import ApiError
from models import Hand

router = APIRouter()


class FavoriteRequest(BaseModel):
    favorite: bool


@router.get("/hands")
def list_hands(user_id: str = Depends(current_user_id)) -> dict:
    store.ensure_profile(user_id)  # first visit: add the sample hands
    return {"hands": store.list_hands(user_id)}


@router.put("/hands/{hand_id}")
def save_hand(hand_id: str, hand: Hand, user_id: str = Depends(current_user_id)) -> dict:
    if hand.id != hand_id:
        raise ApiError(422, "invalid_request", "hand.id must match the hand id in the URL.")
    return store.save_hand(user_id, hand)


@router.delete("/hands/{hand_id}", status_code=204)
def delete_hand(hand_id: str, user_id: str = Depends(current_user_id)) -> Response:
    if not store.delete_hand(user_id, hand_id):
        raise ApiError(404, "not_found", "That hand does not exist.")
    return Response(status_code=204)


@router.put("/hands/{hand_id}/favorite")
def set_favorite(hand_id: str, body: FavoriteRequest, user_id: str = Depends(current_user_id)) -> dict:
    if not store.set_favorite(user_id, hand_id, body.favorite):
        raise ApiError(404, "not_found", "That hand does not exist.")
    return {"favorite": body.favorite}


@router.get("/hands/{hand_id}/analysis")
def saved_analysis(hand_id: str, user_id: str = Depends(current_user_id)) -> dict:
    saved = store.get_hand(user_id, hand_id)
    if saved is None:
        raise ApiError(404, "not_found", "That hand does not exist.")
    hand = Hand.model_validate(saved["hand"])
    answers = store.load_analysis(user_id, hand_id, store.fingerprint(hand))
    # JSON keys are strings: {"9": {...}}
    results = {}
    for action_index, answer in answers.items():
        results[str(action_index)] = answer
    return {"results": results}
