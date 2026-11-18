# Sample hands shared by the tests.

# The "Aces Cracked" sample hand. Hero (BTN) acts at index 0, 2, 4, 6, 9.
HAND = {
    "id": "hand-001",
    "name": "Aces Cracked",
    "game": {"variant": "nlhe", "format": "cash", "sb": 2, "bb": 5, "ante": 0},
    "hero": "BTN",
    "players": [
        {"position": "BTN", "stack": 700, "cards": ["As", "Ah"]},
        {"position": "BB", "stack": 600, "cards": ["Ad", "5c"], "label": "lag"},
    ],
    "board": {"flop": ["Ks", "Jc", "3s"], "turn": "4h", "river": "2d"},
    "actions": [
        {"street": "preflop", "position": "BTN", "action": "raise", "amount": 15},
        {"street": "preflop", "position": "BB", "action": "raise", "amount": 50},
        {"street": "preflop", "position": "BTN", "action": "call", "amount": 50},
        {"street": "flop", "position": "BB", "action": "bet", "amount": 35},
        {"street": "flop", "position": "BTN", "action": "call", "amount": 35},
        {"street": "turn", "position": "BB", "action": "check"},
        {"street": "turn", "position": "BTN", "action": "bet", "amount": 115},
        {"street": "turn", "position": "BB", "action": "call", "amount": 115},
        {"street": "river", "position": "BB", "action": "bet", "amount": 400},
        {"street": "river", "position": "BTN", "action": "call", "amount": 400},
    ],
    "notes": "Villain is loose.",
}

# "Combo Draw vs Turn Shove": hero is BB this time. $1/$2, 200 each.
COMBO = {
    "id": "hand-003",
    "name": "Combo Draw vs Turn Shove",
    "game": {"variant": "nlhe", "format": "cash", "sb": 1, "bb": 2, "ante": 0},
    "hero": "BB",
    "players": [
        {"position": "BB", "stack": 200, "cards": ["9h", "8h"]},
        {"position": "BTN", "stack": 200, "cards": None, "label": "tag"},
    ],
    "board": {"flop": ["Th", "7h", "2c"], "turn": "Ks", "river": "3d"},
    "actions": [
        {"street": "preflop", "position": "BTN", "action": "raise", "amount": 6},
        {"street": "preflop", "position": "BB", "action": "call", "amount": 6},
        {"street": "flop", "position": "BB", "action": "check"},
        {"street": "flop", "position": "BTN", "action": "bet", "amount": 8},
        {"street": "flop", "position": "BB", "action": "raise", "amount": 30},
        {"street": "flop", "position": "BTN", "action": "call", "amount": 30},
        {"street": "turn", "position": "BB", "action": "bet", "amount": 45},
        {"street": "turn", "position": "BTN", "action": "raise", "amount": 164},
        {"street": "turn", "position": "BB", "action": "call", "amount": 164},
    ],
    "notes": "Villain is a solid reg.",
}
