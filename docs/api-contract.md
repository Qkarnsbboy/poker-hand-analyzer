# API Contract

The requests the frontend sends to the backend, and what comes back. Hand shape is defined in `data-model.json`.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/analyze` | Recommendation for one hero decision |
| POST | `/analyze-hand` | Post-mortem and tips for the whole hand |
| GET | `/health` | Backend is up |

## `POST /analyze`

Called when the replayer lands on a hero decision node.

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
  "theory": [
    "You're getting 3:1, so you need 25% equity to call.",
    "Villain's raise range here is mostly two pair and sets.",
    "Your overpair is behind most of it but has outs."
  ],
  "exploitative": [
    "Villain is passive, so his raises are weighted toward value.",
    "Passive players rarely bluff-raise the flop."
  ],
  "what_would_change_this": "If villain were aggressive, his raise range widens and this becomes a clear call."
}
```

- `recommendation.action`: fold, check, call, bet, raise
- `sizing`: total amount (same rule as the data model), `null` unless the action is bet or raise
- `confidence`: high, medium, low
- `theory`: 2 to 4 strings, the balanced/GTO view (ranges, pot odds, blockers)
- `exploitative`: 2 to 4 strings, adjustments based on villain tendencies and `hand.notes`
- `action_index` is echoed back so the frontend can drop stale responses

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
| 422 | `invalid_request` | Malformed hand, or `action_index` is not a hero decision |
| 502 | `llm_error` | LLM call failed or returned unparseable output |
| 504 | `llm_timeout` | LLM call exceeded 30 seconds |

## Frontend behavior

- **Loading:** show a loading state in the right panel while a request is in flight
- **Failure (any error):** show a warning icon and "Analysis unavailable", with a retry button
- **Non-decision nodes:** right panel is empty, no request is made
- **Stale responses:** ignore a `/analyze` response whose `action_index` doesn't match the current node

## Backend notes

- The backend computes pot, to_call, pot odds, and SPR from the action list and puts them in the LLM prompt. The LLM never does arithmetic.
- These numbers are not returned to the frontend in v1.
- Villain hole cards are optional (`null` when unknown). The prompt should say when they're unknown so the LLM reasons about a range.
