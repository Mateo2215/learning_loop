# Handoff: Learning Loop — v3 (Polish, dark/light)

## Overview

Learning Loop is a spaced-repetition learning app. The user uploads materials (PDFs, articles, notes); the app auto-generates flashcards (`generate_cloze`, `generate_open`), open questions, and audit checks via Claude (Haiku for generation, Sonnet for validation, Voyage for embeddings). This handoff covers **10 screens** for the Polish UI.

The user is rebuilding on **Next.js + Vercel** with an existing `app/(app)/*` route structure and `app/globals.css` token system.

## About the Design Files

Files in `reference/` are **design references in HTML/JSX** — prototypes showing intended look and behavior, not production code. Recreate them in the existing Next.js codebase using its patterns (components, routing, styling layer). Keep business logic, API contracts and data fetching intact. Only the presentation layer changes.

## Fidelity

**High-fidelity.** Colors, type, spacing, radii and shadows are final. Tokens in `reference/tokens-v2.css` are copied 1:1 from the user's existing `app/globals.css` — they should map directly.

## Tech stack

- **Framework**: Next.js 14+ (App Router). Routes match what the user already has: `/dashboard`, `/materials`, `/materials/[id]`, `/sessions/review`, `/sessions/deep-dive`, `/sessions/audit`, `/stats`, `/settings`, `/costs`.
- **Styling**: existing `app/globals.css` tokens (already match `tokens-v2.css`). Use Tailwind or CSS modules — whichever the repo uses.
- **Fonts** (`next/font/google`): `Geist`, `Geist Mono`, `Source Serif 4`.
- **Icons**: inline SVG in the reference; swap for `lucide-react` in production (every icon used has a 1:1 equivalent: `arrow-left`, `arrow-right`, `clock`, `check`, `sparkles`, `shuffle`, `mic`, `moon`, `chevron-down`, `search`, `book-open`, `x`).
- **State**: local React state in mocks; replace with the existing data layer.

## Screens (10 total)

| # | Screen | Route | Notes |
|---|---|---|---|
| 01 | Przegląd (Dashboard) | `/dashboard` | Greeting + today's loop hero, streak, "Do zrobienia dziś" KPIs, recent materials list, library snapshot |
| 02 | Materiały (Library list) | `/materials` | Search + tag filters, grouped by month, FSRS distribution bar per material |
| 03 | Materiał — szczegół | `/materials/[id]` | PDF cover, mastery bar with FSRS breakdown, highlighted source quote, tabs: Fiszki / Pytania otwarte / Źródło / Notatki |
| 04 | Sesja powtórek | `/sessions/review` | Card stack (3D depth), progress strip, side panel: Z źródła / Historia karty / Następne / Statystyki sesji, grading row (Znów/Trudne/Dobrze/Łatwe) |
| 05 | Deep Dive — picker | `/sessions/deep-dive` | Material picker + active question preview + previous score |
| 06 | Deep Dive — aktywne pytanie | `/sessions/deep-dive/[qid]` | Full-screen focus mode, large serif question, single textarea + mic |
| 07 | Audyty | `/sessions/audit` | 7d/30d/90d legend, sections: Zaległe / Nadchodzące / Ostatnio wykonane |
| 08 | Statystyki | `/stats` | This week + efficacy cards, KPI row, 8-week activity bar chart, costs preview |
| 09 | Ustawienia | `/settings` | Theme toggle + auto-night, AI calibration, costs progress, JSON export, danger zone |
| 10 | Koszty | `/costs` | Today/Month/Projection cards, per-operation + per-model breakdowns, recent calls table from `usage_logs` |

## Design tokens

All tokens live in `reference/tokens-v2.css`. They map 1:1 to the user's `app/globals.css` — just keep using those.

**Dark theme (default):**
- bg: `#0F0E0B` sunken, `#14130F` canvas, `#1E1C17` surface, `#2A2722` elevated
- fg: `#F5F4F0` primary, `#D5D4CF` secondary, `#8A8A82` muted
- accent: `#E8915E` (terracotta), accent-2: `#6FBFA0` (sage)
- semantic: success `#5BA888`, warning `#D9A847`, danger `#D9614C`

**Light theme:** mirror values in `tokens-v2.css` under `[data-theme="light"]`.

**Type scale:** 11 / 12 / 13 / 14 / 18 / 22 / 28 / 36 / 40 / 44 / 48 px.
- Body → Geist 13–14, line-height 1.5
- Headlines / card fronts → Source Serif 4, weight 500, tracking -0.015em
- Mono / chips / numbers → Geist Mono, uppercase labels at 11px tracking 0.15em

**Radii:** 4 / 6 / 8 / 10 / 12 / 16 px. **Borders:** 1px solid `var(--border-default)` everywhere.

## Files in this bundle

- `README.md` — this file
- `reference/Learning Loop v3.html` — entry point with all 10 artboards on a `DesignCanvas`
- `reference/tokens-v2.css` — token definitions (dark + light)
- `reference/screens-v2/` — JSX source per screen group:
  - `main.jsx` — Przegląd, Materiały (list)
  - `material-detail.jsx` — Materiał szczegół + tabs
  - `sessions.jsx` — Sesja powtórek (basic), Deep Dive (picker)
  - `study.jsx` — Sesja powtórek (rich, with side panel)
  - `extras.jsx` — Deep Dive active, Audyty, Statystyki, Ustawienia, Koszty
- `reference/design-canvas.jsx`, `reference/tweaks-panel.jsx` — canvas chrome (not part of the app)

## Implementation notes

- **Theme switch**: the design uses `[data-theme="dark"|"light"]` on `<body>`. Hook this up to a context + `localStorage` or use `next-themes`.
- **Top nav** (`TopNav` component repeated in each screen): single sticky header, max-width 1024, with `Sesje` and `Menu` dropdowns. Extract into `app/(app)/layout.tsx`.
- **Sesja powtórek (#04)** is the only screen WITHOUT the top nav — it's a focus mode. Same with Deep Dive active (#06).
- **Mastery bar segments** (Materiały + Materiał szczegół) are color-coded: success=mature, accent=young, warning=learning, muted=new. Always 4 segments, summing to total card count.
- **Costs page** uses `usage_logs` table — operations: `generate_open`, `generate_cloze`, `generate_audit_questions`, `compress_material`, `validate_open_answer`, `auto_tag_material`, `embed_material`. Models: `claude-haiku-4-5`, `claude-sonnet-4-6`, `voyage-3`.
- All copy is **Polish**. Don't translate.

## Open questions for the developer

1. Confirm route names match the existing repo (we assumed `app/(app)/sessions/audit`, `app/(app)/costs`).
2. Confirm `usage_logs` schema matches the columns in the costs table.
3. Light theme has not been visually reviewed at every screen — sanity-check after wiring.
