@AGENTS.md

## Git
- Never push to GitHub except when deploying (owner, 2026-09-12). Commit locally; push only with a deploy.

## Local dev database
- Create the local Postgres DB as UTF8 (`create database zola encoding 'UTF8' template template0`). The Windows installer defaults to WIN1252, and every reply containing an emoji then fails to insert and is lost (found 2026-09-13; old DB kept as `zola_win1252`).
