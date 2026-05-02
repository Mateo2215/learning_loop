import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

/**
 * Shared layout for all authenticated routes. Renders the top navigation bar.
 * Auth check is also done in middleware (proxy.ts), but we re-check here to
 * fail closed if the cookie is somehow stale.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="font-semibold text-sm">
            Learning Loop
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink href="/dashboard" label="Dashboard" />
            <NavLink href="/materials" label="Materiały" />
            <NavLink href="/search" label="Szukaj" />
            <NavLink href="/sessions/review" label="Review" />
            <NavLink href="/sessions/deep-dive" label="Deep Dive" />
            <NavLink href="/sessions/audit" label="Audyty" />
            <NavLink href="/gaps" label="Luki" />
            <NavLink href="/costs" label="Koszty" />
            <NavLink href="/settings" label="Ustawienia" />
            <span className="hidden sm:inline-block text-xs text-zinc-500 dark:text-zinc-400 font-mono mx-3">
              {user.email}
            </span>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                Wyloguj
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 text-sm rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
    >
      {label}
    </Link>
  );
}
