"""Who is calling? Checks the Supabase login token and returns the user's id.

The browser logs in with Supabase and gets a signed token (a JWT). It sends the token
on every request: "Authorization: Bearer <token>". We check the signature with
Supabase's PUBLIC keys, so no secret is needed here. The user id is taken only from
a token that passes these checks, never from the request body.
"""

import os
from typing import Optional

import jwt
from fastapi import Header

from errors import ApiError

_key_client: Optional[jwt.PyJWKClient] = None


def supabase_url() -> str:
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not url:
        raise ApiError(500, "server_error", "SUPABASE_URL is not set in backend/.env.")
    return url


def key_client() -> jwt.PyJWKClient:
    """Downloads Supabase's public signing keys once, then reuses them."""
    global _key_client
    if _key_client is None:
        _key_client = jwt.PyJWKClient(supabase_url() + "/auth/v1/.well-known/jwks.json")
    return _key_client


def current_user_id(authorization: Optional[str] = Header(default=None)) -> str:
    """FastAPI dependency: the logged-in user's id, or a 401 error."""
    # The header must look like "Bearer <token>".
    if not authorization or not authorization.startswith("Bearer "):
        raise ApiError(401, "unauthorized", "Please log in.")
    token = authorization.removeprefix("Bearer ").strip()

    try:
        # Find the public key the token says it was signed with.
        signing_key = key_client().get_signing_key_from_jwt(token)
        # Check the signature, the expiry, who issued it, and who it is for.
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            audience="authenticated",
            issuer=supabase_url() + "/auth/v1",
        )
    except jwt.ExpiredSignatureError:
        raise ApiError(401, "unauthorized", "Your login expired. Please log in again.")
    except jwt.PyJWTError:
        raise ApiError(401, "unauthorized", "Invalid login token. Please log in again.")

    # "sub" (subject) is the Supabase user id.
    user_id = claims.get("sub")
    if not user_id:
        raise ApiError(401, "unauthorized", "Invalid login token. Please log in again.")
    return user_id
