# Project Lessons — Learning Loop

Project-specific gotchas. For universal patterns see `../../global-lessons.md`.

## Bootstrap

- **`create-next-app` rejects directory names with spaces or capital letters.** Folder must match npm naming rules (lowercase + dashes only). Lesson learned by attempting to bootstrap into `Learning Loop/` — had to rename to `learning-loop/`.
- **`create-next-app` refuses to run in non-empty dirs**, even if existing files (CLAUDE.md, .env.local) don't conflict with the template. Workaround: stash existing files outside the dir, run bootstrap, restore. There's no `--force` flag in v16.
- **Next.js 16 ships its own `CLAUDE.md` that imports `AGENTS.md`** via `@AGENTS.md` syntax. Our project CLAUDE.md is the source of truth — we overwrite the bootstrap one but keep `AGENTS.md` (contains useful warning that Next.js 16 has breaking changes vs training data).
- **shadcn `init --yes` still prompts** for the component library choice (Radix vs Base). Workaround: pre-create `components.json` manually with `style: "new-york"`, then `add` works without prompts.
- **shadcn does not install `clsx`, `tailwind-merge`, `class-variance-authority`, `@radix-ui/react-slot` automatically** — must install manually before any component will compile.
- **Next.js 16 renamed `middleware.ts` → `proxy.ts`** (and the exported function from `middleware()` → `proxy()`). The matcher config and request handling stay identical. The dev server logs a deprecation warning but still runs the old file. Codemod available: `npx @next/codemod@canary middleware-to-proxy .`. Affects only the root convention file — internal helpers like `lib/supabase/middleware.ts` keep their names.
- **Killing background dev servers on Windows requires `taskkill //PID <pid> //F`** — `pkill` and `kill %1` from bash do not actually terminate the Node process holding the port. Always check `netstat -ano | findstr :3000` to confirm port is free before restarting.
- **Dev server can die silently after long sessions** (HMR + many file edits + auth redirect loops). Symptom: `ERR_CONNECTION_REFUSED` in browser. Fix: `netstat -ano | findstr :3000` to confirm dead, then `npm run dev` again. Not an app problem — a dev-mode quirk on Windows.

## Security (env / secrets)

- **Claude Code injects modified file contents via `system-reminder`** — bypasses `.gitignore` and `permissions.deny`. Any edit to `.env.local` in a tracked working directory leaks values to the conversation transcript regardless of editor used (VSCode, Notepad — same result).
- **Workaround in this project**: IDE-level "ignore file" toggle on `.env.local` blocks system-reminder injection. Verified working after folder rename — but the toggle is per-path, so renaming the project folder requires re-toggling.
- **If toggle is unavailable**: move secrets out of working dir (`~/.secrets/learning-loop/.env.local`) and load via `dotenv.config({ path: ... })` in `next.config.ts`, OR use Windows User Environment Variables (Win+R → `sysdm.cpl`).

## Supabase

- **Magic Link emails may use implicit flow even when client uses PKCE.** `@supabase/ssr` v0.10 sends `signInWithOtp` requests with PKCE, but Supabase's default "Confirm signup" email template still generates implicit-flow links (token in URL hash, e.g. `#access_token=...&refresh_token=...`). The hash never reaches the server, so a server-only `/auth/callback` handler that only looks at `?code=` will fail with "missing_code". Solution: server callback redirects no-code requests to a client page (`/auth/finish`) that reads `window.location.hash` and calls `supabase.auth.setSession({ access_token, refresh_token })`. Now both Magic Link variants land on /dashboard.
- **Mail link-preview can consume Magic Links before the user clicks them**, causing `otp_expired` on first attempt. Outlook desktop and some Gmail filters fetch URLs in the background to show previews. If a fresh link works on second try, this is the cause. Workaround: tell the user to ignore expired-link errors and request a fresh one.
- **`signInWithOtp` does NOT differentiate signup vs login.** First call for a new email triggers signup confirmation. Subsequent calls send a Magic Link as expected. There's no separate "register" UI needed.

## AI cost / latency

- (none yet — to fill during Phase 3+)
