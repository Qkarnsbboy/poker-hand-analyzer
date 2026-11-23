# API Contract

The requests the frontend sends to the backend, and what comes back. Hand shape is defined in `data-model.json`.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/analyze` | Recommendation for one hero decision (saved per hand) |
| GET | `/hands` | The user's saved hands, with favorite flags |
| PUT | `/hands/{hand_id}` | Save a new hand, or replace an edited one |
| DELETE | `/hands/{hand_id}` | Delete a hand and its saved analysis |
| PUT | `/hands/{hand_id}/favorite` | Set or clear the favorite flag |
| GET | `/hands/{hand_id}/analysis` | Saved answers for the hand's current version |
| GET | `/usage` | This month's spend and the caps |
| POST | `/analyze-hand` | Post-mortem and tips for the whole hand (not built) |
| GET | `/health` | Backend is up (no login needed) |

## Authentication (v2)

- Every endpoint except `/health` needs `Authorization: Bearer <access token>`. The token comes from Supabase login in the browser.
- The backend checks the token's signature with Supabase's public keys (JWKS), and takes the user id only from the token.
- A missing, expired, or invalid token returns `401 unauthorized`.
- Each user sees only their own hands and analysis.

## `POST /analyze`

Called once per hero decision, all in parallel, when a hand is saved from the builder (or first opened, if it has no saved analysis). Answers are saved in browser storage, so the replayer shows them instantly.

### Request

```json
{
  "hand": { "...": "full hand object, see data-model.json" },
  "action_index": 4
}
```

- `action_index` is the position in `hand.actions`, the same number the replayer tracks
- `actions[action_index].position` must equal `hand.hero`, otherwise `422`

### Response `200`

```json
{
  "action_index": 4,
  "recommendation": {
    "action": "call",
    "sizing": null,
    "confidence": "medium"
  },
  "theory": {
    "hero_range": ["Hero's overpair is in the middle of Hero's range here."],
    "villain_range": ["Villain's raise range is mostly two pair and sets."],
    "board_texture": ["The two hearts give Villain flush draws to semi-bluff with."],
    "bet_sizing": ["Hero gets 3:1, so Hero needs 25% equity to call."]
  },
  "exploitative": {
    "theory_baseline": ["Calling is close to break-even in theory."],
    "player_type": ["Passive players rarely bluff-raise the flop."],
    "reads": ["The notes say Villain was passive preflop."],
    "adjustment": ["Fold more often: Villain's raises are weighted toward value."]
  }
}
```

- `recommendation.action`: fold, check, call, bet, raise
- `sizing`: total amount (same rule as the data model), `null` unless the action is bet or raise
- `confidence`: high, medium, low
- `theory`: four buckets, each a list of 1 to 3 short bullets
  - `hero_range`: Hero's range here, and where Hero's hand fits in it
  - `villain_range`: Villain's possible hands, given the action
  - `board_texture`: how the board affects both ranges
  - `bet_sizing`: pot odds, SPR, sizing
- `exploitative`: four buckets, each a list of 1 to 3 short bullets
  - `theory_baseline`: the default play, simply
  - `player_type`: how this type (or the typical player, if unknown) deviates from theory
  - `reads`: what the notes suggest; empty list when there are no notes
  - `adjustment`: the recommended play, given everything
- `action_index` is echoed back so the frontend can drop stale responses

### Saving and reuse (v2)

- If the hand is saved and an answer exists for this action and this exact version of the hand (fingerprint), the saved answer is returned. No Claude call, no cost.
- Otherwise Claude is called, and the answer is saved and the cost recorded.
- Before a Claude call, the spend caps are checked. Over a cap: `429 usage_limit`.

## `GET /hands`

```json
{
  "hands": [
    { "hand": { "...": "full hand object" }, "favorite": true, "created_at": "2026-11-21T19:08:28+00:00" }
  ]
}
```

- Newest first. On a user's first request, the sample hands are added once.

## `PUT /hands/{hand_id}`

- Body: the full hand object. `hand.id` must equal `{hand_id}`.
- Creates the hand, or replaces it. If the content changed, its saved analysis no longer matches and is re-run when needed.
- Response: `{ "hand": {...}, "favorite": false, "created_at": "..." }`

## `PUT /hands/{hand_id}/favorite`

- Body: `{ "favorite": true }`. Response: `{ "favorite": true }`. `404 not_found` if the hand does not exist.

## `DELETE /hands/{hand_id}`

- Response `204`. Saved analysis for the hand is deleted too.

## `GET /hands/{hand_id}/analysis`

```json
{ "results": { "9": { "...": "AnalyzeResponse" } } }
```

- Keys are action indexes. Only answers that match the hand's current version.

## `GET /usage`

```json
{ "month_spend_usd": 0.42, "user_cap_usd": 2.0, "total_cap_usd": 20.0 }
```

## `POST /analyze-hand`

Called when the replayer reaches the end of the hand.

### Request

```json
{
  "hand": { "...": "full hand object" }
}
```

### Response `200`

```json
{
  "post_mortem": [
    "Preflop open from the button is standard.",
    "The flop cbet is fine, but the call against the check-raise was loose given villain's passive read."
  ],
  "tips": [
    "Against passive players, a check-raise is heavily weighted to strong hands. Fold more often."
  ]
}
```

- `post_mortem`: 2 to 5 strings, roughly in hand order
- `tips`: 1 to 3 strings
- No score or grade in v1

## Errors

All errors use one shape:

```json
{
  "error": {
    "code": "llm_timeout",
    "message": "Analysis took too long."
  }
}
```

| Status | `code` | When |
|--------|--------|------|
| 401 | `unauthorized` | Missing, expired, or invalid login token |
| 404 | `not_found` | The hand does not exist for this user |
| 422 | `invalid_request` | Malformed hand, or `action_index` is not a hero decision |
| 429 | `usage_limit` | The user or the app is over its monthly Claude spend cap |
| 503 | `auth_unavailable` | The backend could not reach Supabase to check the login token |
| 502 | `llm_error` | LLM call failed or returned unparseable output |
| 504 | `llm_timeout` | LLM call exceeded 30 seconds |

## Frontend behavior

- **Login:** the app shows a login screen until Supabase gives a session. A `401` sends the user back to it.
- **Pre-run:** every hero decision is analyzed up front; answers are saved per hand (in the database in v2) and re-run when the hand is edited
- **Over the cap:** show "Monthly analysis limit reached" in the panel; replaying saved answers still works
- **Loading:** show a loading state only if you reach a decision before its answer has arrived
- **Failure (any error):** show a warning icon and "Analysis unavailable", with a retry button
- **Non-decision nodes:** right panel is empty
- **Stale responses:** ignore a `/analyze` response whose `action_index` doesn't match the current node

## Backend notes

- The backend computes pot, to_call, pot odds, and SPR from the action list and puts them in the LLM prompt. The LLM never does arithmetic.
- The backend also computes hand strength (from the flop on): Hero's hand category and every Villain hand that beats or ties it, grouped (e.g. "Full House: KK"). The LLM judges which of those are in Villain's range; it does not rank hands itself.
- These numbers are not returned to the frontend in v1.
- Villain hole cards are optional (`null` when unknown). The prompt should say when they're unknown so the LLM reasons about a range.
