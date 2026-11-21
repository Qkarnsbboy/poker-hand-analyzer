"""Apply database migrations: every .sql file in migrations/ that has not run yet, in order.

Usage (from backend/):  .venv/bin/python migrate.py

Which files already ran is recorded in the schema_migrations table, so running this
again is safe: it skips them.
"""

import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv

MIGRATIONS_FOLDER = Path(__file__).parent / "migrations"


def main() -> None:
    load_dotenv(Path(__file__).parent / ".env")
    database_url = os.environ["DATABASE_URL"]

    with psycopg.connect(database_url) as conn:
        # The table that remembers which migrations ran.
        conn.execute(
            """
            create table if not exists public.schema_migrations (
                filename   text primary key,
                applied_at timestamptz not null default now()
            )
            """
        )
        conn.execute("alter table public.schema_migrations enable row level security")
        conn.commit()

        already_applied = set()
        for row in conn.execute("select filename from public.schema_migrations"):
            already_applied.add(row[0])

        # Files run in name order: 001_..., 002_..., ...
        for path in sorted(MIGRATIONS_FOLDER.glob("*.sql")):
            if path.name in already_applied:
                print(f"skip   {path.name} (already applied)")
                continue

            # Each file runs in one transaction: all of it applies, or none of it.
            with conn.transaction():
                conn.execute(path.read_text())
                conn.execute("insert into public.schema_migrations (filename) values (%s)", (path.name,))
            print(f"apply  {path.name}")

    print("Database is up to date.")


if __name__ == "__main__":
    main()
