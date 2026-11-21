-- 001: the first tables. See "Accounts and storage (v2)" in docs/poker-analyzer-decisions.md.
--
--   auth.users (made by Supabase)
--     ├── profiles   one row per user
--     ├── hands      many per user
--     │     └── analysis   one row per hero decision in a hand
--     └── llm_calls  one row per Claude call (for spend caps)


-- One row per user. Created the first time the user calls the backend.
create table public.profiles (
    user_id       uuid primary key references auth.users (id) on delete cascade,
    samples_added boolean not null default false,   -- were the sample hands added yet?
    created_at    timestamptz not null default now()
);


-- A saved hand. The hand itself is stored as JSON, in the data-model.json shape.
-- The same hand_id (e.g. "hand-001") can exist for many users, so the key is both.
create table public.hands (
    user_id    uuid not null references auth.users (id) on delete cascade,
    hand_id    text not null,
    hand       jsonb not null,
    favorite   boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (user_id, hand_id)
);


-- Claude's answer for one hero decision. action_index points into hand.actions.
-- fingerprint = the version of the hand the answer was made for. If the hand is
-- edited, the fingerprint no longer matches and the answer is re-run.
-- Deleting the hand deletes its answers.
create table public.analysis (
    user_id      uuid not null,
    hand_id      text not null,
    action_index integer not null check (action_index >= 0),
    fingerprint  text not null,
    result       jsonb not null,
    created_at   timestamptz not null default now(),
    primary key (user_id, hand_id, action_index),
    foreign key (user_id, hand_id) references public.hands (user_id, hand_id) on delete cascade
);


-- Every Claude call, success or not. Used for the monthly spend caps.
-- Kept even if the user is deleted (user_id becomes null), because it is billing history.
create table public.llm_calls (
    id            bigint generated always as identity primary key,
    user_id       uuid references auth.users (id) on delete set null,
    hand_id       text,
    action_index  integer,
    model         text not null,
    status        text not null,                       -- ok, error, timeout
    input_tokens  integer not null default 0,
    output_tokens integer not null default 0,
    cost_usd      numeric(10, 5) not null default 0,
    seconds       numeric(6, 1),
    created_at    timestamptz not null default now()
);

-- Fast "how much did this user spend this month?" and "how much did everyone spend?"
create index llm_calls_user_time on public.llm_calls (user_id, created_at);
create index llm_calls_time on public.llm_calls (created_at);


-- Row-level security ON, with no policies: the browser's publishable key can read
-- and write nothing. Only the backend (with the database password) reaches these rows.
alter table public.profiles  enable row level security;
alter table public.hands     enable row level security;
alter table public.analysis  enable row level security;
alter table public.llm_calls enable row level security;
