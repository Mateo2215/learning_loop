# Learning Loop

Personal learning application that closes the gap between podcast consumption and validated knowledge retention. Single-tenant, built for one user.

**The problem**: NotebookLM podcasts get consumed during walks, but there's no validation of comprehension and no spaced retrieval — the information evaporates.

**The solution**: active recall + spaced repetition (FSRS) + AI validation + a closed loop with Claude.ai for filling detected knowledge gaps.

## How the loop works

1. **Import** a material (DOCX / MD / TXT / paste). A background pipeline compresses it, auto-tags it, embeds it (Voyage), and generates cloze flashcards + open questions.
2. **Review** cloze flashcards on an FSRS schedule (Again / Hard / Good / Easy).
3. **Deep Dive** answers open questions; Claude (Sonnet) validates them, with per-category calibration.
4. **Audits** re-check mastered material on an adaptive schedule.
5. **Gap detection** spots weak areas and generates a ready-to-paste prompt for Claude.ai; importing the resulting report closes the loop.

## Tech stack

- **Next.js 16** (App Router) + TypeScript (strict)
- **Supabase** — Postgres + Auth (Magic Link) + Realtime + pgvector, RLS on every table
- **Anthropic Claude** — Haiku 4.5 (high-volume) + Sonnet 4.6 (validation, generation, gap analysis). No Opus.
- **Voyage AI** (`voyage-3`) for embeddings
- **ts-fsrs** for spaced repetition
- **Tailwind + shadcn/ui**, PWA with a hand-written service worker, offline session queue (`idb`)

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase + Anthropic + Voyage keys
npm run dev                          # http://localhost:3000
```

Apply the SQL migrations in `supabase/migrations/` (in order, `0001` → `0010`) via the Supabase SQL Editor.

## Project documentation

- **[CLAUDE.md](CLAUDE.md)** — architecture, data model, conventions, AI strategy (read first when working on the project). Note: its "API Endpoints" section is design intent; `app/api/` is the source of truth.
- **[PROGRESS.md](PROGRESS.md)** — session-by-session change log (most recent on top).
- **[tasks/todo.md](tasks/todo.md)** — current state and remaining work.
- **[tasks/lessons.md](tasks/lessons.md)** — project-specific lessons learned.

## Status

M1 (core loop), M2 (smart layer) and M3 (polish & mobile) are complete. Remaining work (production deploy, optional features like dispute UI, bulk/URL import, voice input) is tracked in `tasks/todo.md`.
