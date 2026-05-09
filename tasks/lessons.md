# Project Lessons — Learning Loop

Project-specific gotchas. For universal patterns see `../../global-lessons.md`.

## M3 Phase 10 — Reading Room reskin

- **Tokens martwe to nie tokens.** W Phase 1 zdefiniowaliśmy semantyczną paletę (`--bg-canvas`, `--accent`, etc.) ale grep przez kod zwracał 0 użyć — wszystko siedziało w `bg-zinc-50 dark:bg-black`. Phase 10 zaczynała się od podpięcia `@theme inline` w Tailwind v4, dopiero wtedy `bg-canvas` itp. działały jako natywne utility. Lekcja: jeśli definiujesz tokens, w tej samej fazie podepnij je do warstwy stylowania i zmigruj choć jeden plik na nie — inaczej rosną osobno od kodu.
- **Tailwind v4 `@theme inline` mapping**: prefix `--color-*` dla kolorów, `--font-*` dla fontów. Wartości wskazują na CSS vars (`--color-canvas: var(--bg-canvas)`). Bez prefixów Tailwind nie generuje utilities. Ten projekt nie ma `tailwind.config.ts` — cała konfiguracja jest w `globals.css` (`@theme inline { ... }`).
- **Source Serif 4 w `next/font/google` potrzebuje `latin-ext` dla polskiego.** Default `subsets: ["latin"]` daje fallbacki dla ą/ę/ł/ó i wygląda niespójnie. Musi być `subsets: ["latin", "latin-ext"]`.
- **Sessions chrome-less via gating, nie osobny layout.** Plan proponował `app/(app)/sessions/layout.tsx` bez topbara, ale `(app)/layout.tsx` i tak owija children — drugi layout komplikuje. Czystsze: gating w TopNav i BottomNav przez `usePathname` + helper `isSessionRunPath()`. Mniej plików, ten sam efekt.
- **Custom client tabs > shadcn tabs.** Dla 1 use-case (Fiszki/Pytania w `materials/[id]`) napisanie 30-linijkowego `ItemsTabs` jest tańsze niż dodanie kolejnej shadcn paczki + radix dep.
- **Calibration buttons: ikona + skrócony tekst.** Subagent UI review proponował icon-only — w praktyce użytkownik musi zgadywać. Kompromis: lucide ikona (AlertTriangle/Check/Smile) + skrócony tekst (Surowo/Trafnie/Pobłażliwie) zamiast pełnego "Za surowo/Trafnie/Za pobłażliwie".
- **Mechaniczny refactor: deleguj subagentowi.** 33 pliki z paterstwem `bg-zinc-* → bg-canvas` itd. — subagent z jasną mapą i regułami niejednoznacznych przypadków (emerald jako accent vs ok) zrobi 80% w jednym przejściu. Ja domknąłem ostatnie 13 plików ręcznie po tym jak subagent trafił rate-limit.
- **OnlineIndicator pozycja vs BottomNav.** `fixed bottom-3` koliduje z bottom-nav na mobile. Fix: `bottom-20 left-3 md:bottom-3` — pill siedzi nad nav-em na mobile, w dolnym lewym rogu na desktop.

## Bootstrap

- **`create-next-app` rejects directory names with spaces or capital letters.** Folder must match npm naming rules (lowercase + dashes only). Lesson learned by attempting to bootstrap into `Learning Loop/` — had to rename to `learning-loop/`.
- **`create-next-app` refuses to run in non-empty dirs**, even if existing files (CLAUDE.md, .env.local) don't conflict with the template. Workaround: stash existing files outside the dir, run bootstrap, restore. There's no `--force` flag in v16.
- **Next.js 16 ships its own `CLAUDE.md` that imports `AGENTS.md`** via `@AGENTS.md` syntax. Our project CLAUDE.md is the source of truth — we overwrite the bootstrap one but keep `AGENTS.md` (contains useful warning that Next.js 16 has breaking changes vs training data).
- **shadcn `init --yes` still prompts** for the component library choice (Radix vs Base). Workaround: pre-create `components.json` manually with `style: "new-york"`, then `add` works without prompts.
- **shadcn does not install `clsx`, `tailwind-merge`, `class-variance-authority`, `@radix-ui/react-slot` automatically** — must install manually before any component will compile.
- **Next.js 16 renamed `middleware.ts` → `proxy.ts`** (and the exported function from `middleware()` → `proxy()`). The matcher config and request handling stay identical. The dev server logs a deprecation warning but still runs the old file. Codemod available: `npx @next/codemod@canary middleware-to-proxy .`. Affects only the root convention file — internal helpers like `lib/supabase/middleware.ts` keep their names.
- **Killing background dev servers on Windows requires `taskkill //PID <pid> //F`** — `pkill` and `kill %1` from bash do not actually terminate the Node process holding the port. Always check `netstat -ano | findstr :3000` to confirm port is free before restarting.
- **Dev server can die silently after long sessions** (HMR + many file edits + auth redirect loops). Symptom: `ERR_CONNECTION_REFUSED` in browser. Fix: `netstat -ano | findstr :3000` to confirm dead, then `npm run dev` again. Not an app problem — a dev-mode quirk on Windows.
- **Magic Link callback fails with `error=fetch failed` (Node UNABLE_TO_VERIFY_LEAF_SIGNATURE) when AV does HTTPS scanning.** Server-side fetch from Next/Node to Supabase auth endpoint fails because antivirus (Kaspersky/ESET/Bitdefender/Avast) injects a custom root CA that Windows trusts but Node's bundled CA store doesn't. Fix: run dev server with `NODE_OPTIONS=--use-system-ca` (Node 22+ feature — reads Windows cert store). Symptom in logs: `[cause]: Error: unable to verify the first certificate ... code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'`. Browser-side everything looks fine; only server-side `signInWithOtp`/`exchangeCodeForSession` fails. Not specific to Learning Loop — affects any Next.js + Supabase project on a machine with HTTPS-scanning AV.
- **Chrome hangs on `localhost:3000` while `127.0.0.1:3000` works fine.** Stale per-site data in Chrome profile (HSTS entry, cookies, or service worker registration from a prior project) intercepts/breaks `localhost` resolution in normal mode but not in incognito (which has fresh per-site state). Fix: Chrome DevTools → Application → "Clear site data" for localhost, or `chrome://net-internals/#hsts` → delete domain `localhost`, or `chrome://settings/content/all` → search localhost → delete. Test diagnostic: `http://localhost.:3000` (trailing dot) works → confirms it's Chrome's per-host state, not network/DNS/proxy.
- **`npm run build` catches things `npm run dev` ignores.** Always run a production build before declaring a phase done. Two things bit us at M1 close:
  - **`useSearchParams()` must be inside `<Suspense>`** for any page that gets statically prerendered. Dev mode renders everything client-side so it never complains, but `next build` refuses to prerender. Pattern: extract the hook-using subtree into a small inner component, wrap it in `<Suspense fallback={...}>`. Hit this on `/login` and `/auth/finish`.
  - **React 19's `react-hooks/purity` rule** disallows impure calls (`Date.now()`, `Math.random()`, `new Date()`) as initial values in `useState`. ESLint catches this — `npm run build` runs lint as a hard gate. Workaround: use a placeholder initial value (0, null) and set the real one in the matching `useEffect` that runs once on mount.

## Security (env / secrets)

- **Claude Code injects modified file contents via `system-reminder`** — bypasses `.gitignore` and `permissions.deny`. Any edit to `.env.local` in a tracked working directory leaks values to the conversation transcript regardless of editor used (VSCode, Notepad — same result).
- **Workaround in this project**: IDE-level "ignore file" toggle on `.env.local` blocks system-reminder injection. Verified working after folder rename — but the toggle is per-path, so renaming the project folder requires re-toggling.
- **If toggle is unavailable**: move secrets out of working dir (`~/.secrets/learning-loop/.env.local`) and load via `dotenv.config({ path: ... })` in `next.config.ts`, OR use Windows User Environment Variables (Win+R → `sysdm.cpl`).

## Supabase

- **Magic Link emails may use implicit flow even when client uses PKCE.** `@supabase/ssr` v0.10 sends `signInWithOtp` requests with PKCE, but Supabase's default "Confirm signup" email template still generates implicit-flow links (token in URL hash, e.g. `#access_token=...&refresh_token=...`). The hash never reaches the server, so a server-only `/auth/callback` handler that only looks at `?code=` will fail with "missing_code". Solution: server callback redirects no-code requests to a client page (`/auth/finish`) that reads `window.location.hash` and calls `supabase.auth.setSession({ access_token, refresh_token })`. Now both Magic Link variants land on /dashboard.
- **Mail link-preview can consume Magic Links before the user clicks them**, causing `otp_expired` on first attempt. Outlook desktop and some Gmail filters fetch URLs in the background to show previews. If a fresh link works on second try, this is the cause. Workaround: tell the user to ignore expired-link errors and request a fresh one.
- **`signInWithOtp` does NOT differentiate signup vs login.** First call for a new email triggers signup confirmation. Subsequent calls send a Magic Link as expected. There's no separate "register" UI needed.

## AI cost / latency

- **Cron generation = wasted spend.** Don't pre-generate audit questions in the cron heartbeat. Sonnet audit generation costs ~$0.005–$0.02 each; pre-generating for every due audit pays even when the user never runs them. Pattern: cron only counts/surfaces due audits, generation happens lazily on the "Zacznij audyt" click via an idempotent `prepareAudit()`.

## M3 PWA / theming

- **Tailwind v4 `dark:` variant doesn't react to a `data-theme` attribute by default.** Tailwind v4 uses `@media (prefers-color-scheme: dark)`. To get `dark:bg-zinc-900` to fire when `<html data-theme="dark">`, register a custom variant in CSS: `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));`. Without this, the toggle would update tokens but every existing `dark:*` class stays inert.
- **`<html suppressHydrationWarning>` is required when an inline init script flips `data-theme` before hydration.** Server renders without the attribute (light), the inline script adds `data-theme="dark"` synchronously based on localStorage, React hydrates, sees mismatch, throws. `suppressHydrationWarning` silences the legitimate divergence (next-themes does the same).
- **`@ducanh2912/next-pwa` ships 5 high-severity transitive vulns.** `npm audit` after install reports them via Workbox internals. For our scale a vanilla 80-line `public/sw.js` with NetworkFirst/CacheFirst strategies is simpler, has zero new deps, and stays auditable. The trade-off is no auto-generated cache manifest of Next.js bundles, so we cache by URL pattern.
- **Service worker registration must be a no-op in dev.** Workbox dev support is bumpy with Next.js Turbopack; cached static assets fight HMR. Gate registration on `process.env.NODE_ENV === "production"` and only test the SW via `npm run build && npm run start`.
- **Supabase Realtime needs explicit publication entries.** `supabase_realtime` publication exists by default but tables aren't auto-added. `alter publication supabase_realtime add table public.<name>` per table. Without it, channels SUBSCRIBE but no postgres_changes events fire — and the symptom is silence, not an error. Keep polling fallback for safety.
- **`tailwindcss-animate` not installed in this project** — `data-[state=open]:animate-in` etc. classes resolve to nothing. Either install it or skip animation. We chose skip.

## Voyage thresholds

- **Asymmetric similarity is structurally lower than CLAUDE.md assumed.** Gap text (title + 2-4 tags joined, ~30 tokens) vs material content (full document, ~thousands of tokens) gives cosine in the 0.55-0.75 range even on the same topic. The 0.80 threshold suggested in CLAUDE.md was set in the abstract — measured on a real DCF gap matched against a DCF material it returned 0.638. Practical floor for short-text-vs-long-document with Voyage-3: ~0.60. Bumped GAP_MATCH_THRESHOLD to 0.60 in pipeline.ts. If false positives surface in production, revisit (richer gap embeddings — e.g. concat material_titles into the embed text — would raise scores symmetrically without lowering threshold).

## Voyage rate limits

- **Free tier (no payment method) caps at 3 RPM + 10K TPM.** Steady-state app usage is fine (a few embeds/day) but ANY batched op breaks: backfill, gap detection that emits 5+ gaps, bulk import. Symptom: HTTP 429 with body explaining the limit. Adding a payment method (no charge — Voyage gives 200M free tokens for voyage-3 even after) bumps to standard limits ~5 minutes after card verification. Use a virtual card with low limit if uncomfortable. Alternative: throttle to 1 call per 21s globally — works but adds long delays to backfills and gap creation.

## Voyage SDK

- **`voyageai` npm SDK has broken ESM exports under Turbopack production builds.** Symptom: `npm run build` fails with "Module not found: Can't resolve '../Client'" / '../api' / '../errors' / '../local' / './ExtendedClient'. Dev server works fine because Turbopack dev resolution is more lenient. Fix: skip the SDK entirely, call the Voyage REST API directly (`POST https://api.voyageai.com/v1/embeddings` with `Authorization: Bearer $KEY`). The endpoint is trivial — `{ model, input: [text] }` in, `{ data: [{embedding}], usage }` out. No reason to keep an SDK in the bundle just for this.

## M2 audits

- **Audit items need a separate scope.** Audit-generated questions live in `items` (so reviews can FK to them) but with `audit_id` set. Every other reader of `items` (review queue, deep-dive picker, dashboard counts) must filter `audit_id is null`. Easy to forget — would cause regular pools to mix audit questions in. Pattern: explicit `.is("audit_id", null)` on every non-audit query.
- **pg_cron from migrations needs elevated perms.** Supabase SQL Editor with the standard user can't always create pg_cron jobs. Keep the `select cron.schedule(...)` block as a commented snippet **inside** the migration file for the user to paste manually as service_role, rather than relying on it applying automatically.
- **Idempotent question generation.** `prepareAudit()` returns existing items if the audit was already prepared. Critical for browser-refresh-mid-flow: a user who reloads the audit page mustn't burn a second Sonnet call.
