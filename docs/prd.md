# Poker Analyzer: Product Requirements Document

**Author:** Quincy Karns

**Goal:** Personal / portfolio project

## 1. What it is

Poker hand replayer that at each Hero decision, analyzes the game state and recommends an action based on theoretical and exploitative concerns.

## 2. Who it's for

Me / anyone interested in poker hand analysis, more as a proof of concept.

## 3. Problem

There is no poker analysis website that addresses combined theoretical / exploitative concerns within a hand. For example: GTOWizard only shows pre-computed solver outputs that are not realistic to real-life hands / tendencies.

## 4. Must-haves

- **Poker hand replayer** — walk through every action
- **Analysis box** — action (x, b, r, f), size if applicable, reasoning (theory + exploitative)
- **Hand entry tool** — fields for each player: stack size, action, classification, and cards

## 5. Non-goals

- Actual poker solver (too computationally hard)
- Multi-way analysis (heads-up only for now)
- Tournament-related fields (too complicated)
- Hand imports from sites
- Login / account functionality

## 6. Done means

I can enter a heads-up hand I played, step through all actions, and get "decent-sounding" recommendations at each of my decision points.

## 7. Open questions

- Expand to 6-9 handed?
- Actually incorporate some theory and ranging?
- Focus on online or live?
