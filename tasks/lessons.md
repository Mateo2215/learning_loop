# Project Lessons — Learning Loop

Project-specific gotchas. For universal patterns see `../../global-lessons.md`.

## Bootstrap

- **`create-next-app` rejects directory names with spaces or capital letters.** Folder must match npm naming rules (lowercase + dashes only). Lesson learned by attempting to bootstrap into `Learning Loop/` — had to rename to `learning-loop/`.
- **`create-next-app` refuses to run in non-empty dirs**, even if existing files (CLAUDE.md, .env.local) don't conflict with the template. Workaround: stash existing files outside the dir, run bootstrap, restore. There's no `--force` flag in v16.
- **Next.js 16 ships its own `CLAUDE.md` that imports `AGENTS.md`** via `@AGENTS.md` syntax. Our project CLAUDE.md is the source of truth — we overwrite the bootstrap one but keep `AGENTS.md` (contains useful warning that Next.js 16 has breaking changes vs training data).
- **shadcn `init --yes` still prompts** for the component library choice (Radix vs Base). Workaround: pre-create `components.json` manually with `style: "new-york"`, then `add` works without prompts.
- **shadcn does not install `clsx`, `tailwind-merge`, `class-variance-authority`, `@radix-ui/react-slot` automatically** — must install manually before any component will compile.

## Security (env / secrets)

- **Claude Code injects modified file contents via `system-reminder`** — bypasses `.gitignore` and `permissions.deny`. Any edit to `.env.local` in a tracked working directory leaks values to the conversation transcript regardless of editor used (VSCode, Notepad — same result).
- **Workaround in this project**: IDE-level "ignore file" toggle on `.env.local` blocks system-reminder injection. Verified working after folder rename — but the toggle is per-path, so renaming the project folder requires re-toggling.
- **If toggle is unavailable**: move secrets out of working dir (`~/.secrets/learning-loop/.env.local`) and load via `dotenv.config({ path: ... })` in `next.config.ts`, OR use Windows User Environment Variables (Win+R → `sysdm.cpl`).

## Supabase

- (none yet — to fill during Phase 2)

## AI cost / latency

- (none yet — to fill during Phase 3+)
