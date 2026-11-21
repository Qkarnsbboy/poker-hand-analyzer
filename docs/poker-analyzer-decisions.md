# Poker Hand Analyzer: Decisions and Design Notes

Personal project for reviewing my own poker hands. v1 was built for my own use. v2 makes it semi-production for me and a few friends, and it is a portfolio project for FDE interviews.

## Scope

- Reference UI: PokerTracker 4
- Stack: FastAPI, React + TypeScript, Vite, Tailwind (same as `strategy_visualizer`)
- v1 analysis is LLM-only. No live GTO solver.
- Hands are entered manually

### Not in v1

- Live GTO solving
- Hand history file import
- Multiway analysis
- Tournaments, PLO, mixed games
- Auth, database, mobile (v2 adds auth and a database; mobile is still out)

### Solver (parked)

Come back after v1. Options, roughly by effort:

1. Precomputed solve library for common spots
2. Hand-coded GTO heuristics (range vs board texture, cbet frequency)
3. LLM-only (what v1 does)

Notes from research:

- GTO Wizard has no solver API (benchmarking endpoint only)
- TexasSolver (open source, console mode, JSON output) is the realistic option
- A solver needs ranges for both players, and a hand history has none, so a range assignment layer would be needed
- Solves only work heads-up postflop

## Process and file layout

Order: PRD, user flow, wireframes, data model, API contract, CLAUDE.md, then build in vertical slices.

```
poker_analyzer/
  CLAUDE.md
  docs/
    prd.md
    user-flow.md
    wireframes.excalidraw
    data-model.md
    api-contract.md
```

- Docs are markdown in the repo, not Google Docs. Repo copy is the source of truth.
- Filenames use hyphens (kebab-case)
- Wireframes made in the VS Code Excalidraw extension, all frames in one file
- Wireframes use real content (e.g. "Hero $3.15", "Qs Jh 2h"), not component names
- Workflow: think in chat, write the decision into `docs/`, then tell Claude Code to read the docs and build

### Status

| Step | Item | Status |
|------|------|--------|
| 1 | PRD | done |
| 2 | User flow | done |
| 3 | Wireframes (4 frames) | done |
| 4 | Data model | done |
| 5 | API contract | done |
| 6 | CLAUDE.md | done |
| 7 | Slice 1: hardcoded hand, replay reducer, steppable table | done |
| 8 | Slice 2: hand builder | done |
| 9 | Slice 3: analysis panel (backend, poker math, Claude call, pre-run + saved analysis) | done |
| 10 | Slice 4: accounts + database (Supabase login, Postgres, spend caps) | in progress |
| 11 | Slice 5: hosting (Render backend, Vercel frontend, CI, Sentry) | not started |
| 12 | Style pass | not started |

### Build approach

Vertical slices. Each one works end to end before the next starts. Slice 1 hardcodes the hand and skips styling and analysis.

## Accounts and storage (v2)

Moves saved data from browser storage to a database, so it survives a cleared browser and works on any device, and so friends can have their own accounts.

### Stack

- **Supabase** for Postgres and login (one vendor). Region East US (North Virginia), next to the Render backend.
- **Login:** email magic link. Public sign-up is on. Email confirmation is on.
- **Backend talks to the database directly** (psycopg, session pooler). The frontend never talks to the database. It only uses Supabase for login.

### How a request is trusted

```
Browser --magic link--> Supabase Auth --> signed token (JWT)
Browser --"Authorization: Bearer <token>"--> Backend
Backend --checks the token signature (Supabase public keys, JWKS)--> user id
Backend --queries filtered by user id--> Postgres
```

- **Row-level security is on for every table, with no public policies.** The publishable key can never read or write rows. Only the backend can, with its own database credentials.
- The backend never trusts a user id from the request body. It takes it only from the verified token.

### Tables

| Table | Holds | Key |
|---|---|---|
| `profiles` | one row per user; whether sample hands were added | `user_id` |
| `hands` | the hand JSON (same shape as `data-model.json`) + `favorite` flag | `(user_id, hand_id)` |
| `analysis` | Claude's answer per hero decision + the hand fingerprint it was made for | `(user_id, hand_id, action_index)` |
| `llm_calls` | every Claude call: tokens, cost, time | `id` |

- The hand JSON stays exactly as in `data-model.json`. Ownership, favorite and timestamps are columns around it.
- Deleting a hand deletes its analysis (`on delete cascade`).
- **Migrations** are plain SQL files in `backend/migrations/`, applied in order by a small script that records which ones ran.

### Spend caps

- Every Claude call is recorded in `llm_calls` with its cost.
- **Per-user cap** and **total cap** per calendar month, set by env vars. Over a cap, `/analyze` returns `429 usage_limit` and makes no Claude call.
- Saved answers cost nothing, so a cap never blocks replaying old hands.

### Backlog: guest demo + account menu

- Opening the app without logging in shows a **guest demo**: the 3 sample hands, ready to replay, with their analysis.
- Guests cannot save or analyze new hands (no Claude cost). Their saved answers for the samples are pre-computed once and shared.
- A **user icon, top right**: "Sign in" for guests; email and "Sign out" when logged in.
- Logging in switches to the user's own hands.

### Moving existing data

- On first login, if the browser still has hands in local storage, the app offers a one-time import into the account.

## Analysis timing

- **Pre-run, not live.** When a hand is saved, every hero decision goes to Claude in parallel (~7s total, ~1c each). Answers are stored per hand and a fingerprint of its contents (in browser storage in v1, in the `analysis` table in v2), so replaying is instant and free. Editing the hand re-runs it.
- **Decision node markers dropped.** Not needed once analysis is instant.

## UI

- Split screen: replayer on the left (about 60%), action and analysis panel on the right (about 40%)
- Right panel: colored recommendation (bet/raise, call, fold) on top, textual analysis underneath
- "Add a new hand" button, top right
- App opens on a pre-filled hand at a hero decision node (heads-up, tough river spot)
- Hand builder is full screen, with clear sections for preflop, flop, turn, river. Card entry should feel like GTO Wizard and auto-advance to the next node.
- Replayer controls: right arrow for next action, left arrow for previous, shortcuts to jump to preflop, flop, turn, river
- Default hand loads at the river node (index set to that node). Builder exit starts at index 0.
- Builder is the largest piece of UI, bigger than the replayer. Whether it is tolerable decides if the app gets used.

### Wireframe frames

1. Startup
2. Hand entry
3. Replayer at a non-decision step
4. Replayer at a hero decision node

## User flow

1. Open app
2. See a default hand open at a node
3. Click "Add a new hand"
4. Enter hand details: game type, blinds, stack size, hero hole cards, actions per street, villain hole cards, notes
5. Replay the hand from preflop
6. At a hero decision, read the recommendation and reasoning
7. At end of hand, see full-hand analysis with scoring, post-mortem, and tips

## Data model

Core rule: store decisions, derive consequences. Never store pot or current stacks.

```json
{
  "id": "hand-001",
  "game": { "variant": "nlhe", "format": "cash", "sb": 0.5, "bb": 1, "ante": 0 },
  "hero": "BTN",
  "players": [
    { "position": "BTN", "stack": 100, "cards": ["As", "Kd"] },
    { "position": "BB",  "stack": 120, "cards": null }
  ],
  "board": { "flop": ["Qs", "Jh", "2h"], "turn": "7c", "river": null },
  "actions": [
    { "street": "preflop", "position": "BTN", "action": "raise", "amount": 2.5 },
    { "street": "preflop", "position": "BB",  "action": "call",  "amount": 2.5 },
    { "street": "flop",    "position": "BB",  "action": "check" },
    { "street": "flop",    "position": "BTN", "action": "bet",   "amount": 3 },
    { "street": "flop",    "position": "BB",  "action": "raise", "amount": 11 }
  ],
  "notes": "Villain seemed passive preflop"
}
```

### Decisions

- **Actions are one flat ordered list**, each tagged with its street. The replayer indexes into it. Nested by street was rejected.
- **Amounts are totals, not increments.** Raising to 30 stores 30.
- **Positions, not seat numbers.** Positions encode action order.
- **`hero` is a single position reference**, not a per-player boolean. Prevents zero or two heroes.
- **`stack` is the starting stack and never changes.** Current stack is computed.
- **`null` means unknown, a missing key means not applicable.** Never use an empty array for unknown cards. `check` and `fold` have no `amount` key.
- **Closed action set:** fold, check, call, bet, raise. No `all-in` action. All-in is detected by comparing amount to remaining stack.
- **`bet` and `raise` are separate** because their validation rules differ.
- **Cards are two characters:** rank then lowercase suit, `T` for ten (`As`, `Td`, `2h`).
- **`board` uses named keys** (flop, turn, river), `null` for streets not seen.
- **`game` includes `variant`, `format`, `ante`** even though v1 is cash NLHE only. Cheap now, avoids a backfill later.
- **Villain has a `label`** (player type): one of `fish`, `station`, `nit`, `tag`, `lag`, `maniac`, or `null` when unknown. Hero has no `label` key (not applicable). Gives the exploitative analysis a structured read alongside the notes.
- **`notes` is free text** (empty string when unused). Carries villain reads so the LLM analysis can address the actual spot.
- **`call` stores an amount** even though it is derivable, so the JSON is readable by eye.
- **`players` is an array, not an object keyed by position**, because object key order is not guaranteed.

### Derived, never stored

```
pot_at(i)             sum of amounts committed through action i
stack_at(pos, i)      starting stack minus commitments
to_act_at(i)          actions[i].position
to_call_at(i)         current bet minus what they already put in
is_decision_node(i)   actions[i].position == hero
street_at(i)          actions[i].street
```

### Validation rules (for the builder)

- A raise must exceed the current bet
- Cannot check when facing a bet
- Board cards cannot duplicate hole cards
- No action on a street after everyone but one player has folded

## API contract

### Analyze endpoint

`POST /analyze`

- Request: the hand, plus `action_index`
- Response: LLM output only, as structured fields

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

### Decisions

- **Structured fields, not one blob of text.** The wireframe has a colored recommendation separate from the text.
- **`confidence` is a closed set:** high, medium, low.
- **`sizing` is null** unless the action is bet or raise.
- **Reasoning is split into `theory` and `exploitative` arrays**, 2 to 4 bullets each, matching the two boxes in the wireframe. Replaced the single `reasoning` array.
- **`what_would_change_this`** is kept. It makes the output read like a coach, not a verdict.
- **Math context goes into the LLM prompt on the backend** (pot, to_call, pot odds, SPR). The LLM never does arithmetic itself.
- **Math is not returned to the frontend**, because the wireframe does not show odds. The LLM can still cite numbers in its reasoning text. Easy to add a stats strip later.
- **`action_index` is the position in the `actions` array.** It is the same number the replayer tracks. It is returned so the frontend can discard stale responses when clicking quickly through nodes.

### Other endpoints

- `POST /analyze-hand`: post-mortem and tips for the whole hand. No scoring.
- `GET /health`
- Full contract in `docs/api-contract.md`

### Resolved

- **Hands are saved in browser storage (localStorage).** No database or login in v1. All save and load code stays in one file so it can move to a database later.
- **Hand entry adds `name` and both stack sizes.** Game and format are fixed, greyed-out fields (NLHE, cash).
- **No scoring or grades in v1.** LLM grading is inconsistent. `/analyze-hand` returns post-mortem and tips only.
- **Villain hole cards are optional.** `null` when unknown. Most hands never reach showdown.
- **Right panel is empty at non-decision nodes.** No request is made.
- **LLM failure:** loading state while waiting. On any error, show a warning icon and "Analysis unavailable" with a retry button. Backend times out at 30 seconds.

## Open questions

- All-in handling in the reducer and builder (amount capped at stack, detected by comparison).

## CLAUDE.md draft

```markdown
# Poker Hand Analyzer

Scope and decisions: docs/prd.md, docs/data-model.md, docs/api-contract.md

## Stack
FastAPI backend, React + TypeScript + Vite, Tailwind

## Non-goals
- No live GTO solving
- No hand history file import
- No multiway analysis
- No auth or database in v1

## Conventions
- Hand state is derived from the action list, never stored
```
