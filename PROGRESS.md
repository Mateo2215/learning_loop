# PROGRESS.md — Learning Loop

Session handoff log. Most recent entry on top. Keep this file under 200 lines.

---

## 2026-04-30 — Phase 1 Bootstrap (in progress)

### Completed
- Renamed project folder `Learning Loop/` → `learning-loop/` (npm naming rules)
- `create-next-app@latest` (Next 16.2.4, React 19.2, TS strict, Tailwind v4, ESLint, Turbopack, App Router, no src dir, alias `@/*`)
- Installed core deps: `@supabase/supabase-js`, `@supabase/ssr`, `@anthropic-ai/sdk`, `voyageai`, `ts-fsrs`, `mammoth`, `lucide-react`, `sonner`, `zod`, `date-fns`
- Installed shadcn runtime helpers: `clsx`, `tailwind-merge`, `class-variance-authority`, `@radix-ui/react-slot`
- shadcn/ui initialized (`components.json`, neutral base, "new-york" style) + 6 starter components: button, card, input, textarea, skeleton, dropdown-menu
- Created folder structure per CLAUDE.md: `lib/{ai,db,fsrs,processing,utils,supabase}`, `lib/ai/prompts`, `components/{materials,sessions,shared}`, `app/(auth)/{login,callback}`, `app/(app)/{dashboard,materials,sessions/{deep-dive,review},costs,settings}`, `app/api/{materials,sessions,ai,costs}`, `supabase/migrations`, `tasks`, `tools`
- `lib/utils.ts` — `cn()` helper
- `lib/supabase/{client,server,middleware}.ts` — SSR pattern (cookies handled correctly)
- `middleware.ts` (root) — auth gate redirecting unauthenticated to `/login` for `(app)/*` routes
- Merged `.gitignore` (our + Next.js defaults: `.vercel`, `*.pem`)
- `.env.local` populated by user with real keys (Supabase + Anthropic; Voyage pending)
- `tasks/todo.md`, `tasks/lessons.md` created
- Original CLAUDE.md (33KB project source-of-truth) preserved through bootstrap

### In progress
- Verifying dev server starts and dark mode works
- Preparing first git commit

### Blockers
- Voyage AI account creation deferred (their dashboard was unresponsive earlier today). Not a blocker until Phase 4 (material processing pipeline needs embeddings).

### Next session pickup
1. `npm run dev` — verify `/` renders without errors
2. First git commit: "bootstrap learning-loop scaffold"
3. Phase 1 checkpoint with user — get green light to start Phase 2 (DB + Auth)

### Known issues
- `npm audit` reports 2 moderate severity vulnerabilities in transitive deps. To inspect later — not urgent.
- `lucide-react` installed at v1.14.0. shadcn typically uses higher major versions; verify icon imports work during first UI work (Phase 5 onwards).

### Lessons learned (this session)
See `tasks/lessons.md` — bootstrap gotchas with `create-next-app` + shadcn captured there.

### Security incident — RESOLVED
Three rounds of API keys leaked into the conversation transcript via Claude Code's automatic `system-reminder` mechanism (which injects modified file contents regardless of `.gitignore`). All leaked keys revoked at source. Final solution: user toggled IDE-level "ignore file" on `.env.local`, which blocks the leak. Verified working with a "type garbage and save" smoke test before pasting real keys. Memory entry added: `feedback_secrets_handling.md`.
