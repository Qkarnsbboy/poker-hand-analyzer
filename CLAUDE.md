# Poker Hand Analyzer

Personal tool for replaying and reviewing my own poker hands, with LLM analysis at hero decisions.

## Docs (source of truth)

Read these before building. If code and docs disagree, docs win; flag the conflict.

- `docs/poker-analyzer-decisions.md`: decisions, build status, open questions
- `docs/prd.md`: scope and done criteria
- `docs/user-flow.md`
- `docs/data-model.json`: the hand shape
- `docs/api-contract.md`: endpoints, request/response shapes, errors
- `docs/wireframes/`: Excalidraw wireframes

## Stack

FastAPI backend, React + TypeScript + Vite, Tailwind

## Non-goals (v1)

- No live GTO solving
- No hand history file import
- No multiway analysis
- No tournaments, PLO, or mixed games
- No auth, database, saved hands, or mobile
- No scoring or grades

## Conventions

- Hand state is derived from the action list, never stored (no stored pot or current stacks)
- Action amounts are totals, not increments
- Cards are two characters, rank then lowercase suit (`As`, `Td`)
- `null` means unknown, a missing key means not applicable
- The LLM never does arithmetic. The backend computes pot, to_call, pot odds, SPR and puts them in the prompt.
- Filenames are kebab-case

## Build approach

Vertical slices, each working end to end before the next starts. Current slice and status are in the Status table in `docs/poker-analyzer-decisions.md`. Update it when a step finishes.
