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

## Prerequisites

- **Node.js 20+** (Next.js 16 requires Node 20.9 or later)
- A **Supabase** project (free tier is enough) — the first migration enables the `vector`, `pg_cron` and `pgcrypto` extensions automatically
- An **Anthropic API key** and a **Voyage AI API key**

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase + Anthropic + Voyage keys
npm run dev                          # http://localhost:3000
```

Apply the SQL migrations in `supabase/migrations/` (in order, `0001` → `0012`) via the Supabase SQL Editor.

## Project documentation

- **[CLAUDE.md](CLAUDE.md)** — architecture, data model, conventions, AI strategy (read first when working on the project). Reconciled as-built 2026-06-16; for exact API/schema the source of truth is `app/api/**/route.ts` and `supabase/migrations/`.
- **[PROGRESS.md](PROGRESS.md)** — session-by-session change log (most recent on top).
- **[tasks/todo.md](tasks/todo.md)** — current state and remaining work.
- **[tasks/lessons.md](tasks/lessons.md)** — project-specific lessons learned.

## Status

**Deployed and in daily use** (Vercel + Supabase, including mobile). M1 (core loop), M2 (smart layer) and M3 (polish & mobile) are complete.

The app is in a **use-and-iterate-reactively** mode — no active development push; changes land when real use surfaces a concrete need. Remaining items are optional / nice-to-have (dispute UI, bulk/URL import, voice input, Lighthouse audit, Sentry) and tracked in `tasks/todo.md`.

## License

[MIT](LICENSE)
