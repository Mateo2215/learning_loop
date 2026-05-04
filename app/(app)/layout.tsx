import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { MobileNav } from "@/components/shared/mobile-nav";
import { OnlineIndicator } from "@/components/shared/online-indicator";

const NAV_ITEMS: { href: string; label: string }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/materials", label: "Materiały" },
  { href: "/search", label: "Szukaj" },
  { href: "/sessions/review", label: "Review" },
  { href: "/sessions/deep-dive", label: "Deep Dive" },
  { href: "/sessions/audit", label: "Audyty" },
  { href: "/gaps", label: "Luki" },
  { href: "/costs", label: "Koszty" },
  { href: "/settings", label: "Ustawienia" },
];

/**
 * Shared layout for all authenticated routes. On desktop renders the full
 * top navigation; on mobile collapses to a hamburger that opens a side drawer.
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
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="font-semibold text-sm">
            Learning Loop
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} />
            ))}
            <span className="hidden lg:inline-block text-xs text-zinc-500 dark:text-zinc-400 font-mono mx-3">
              {user.email}
            </span>
            <ThemeToggle />
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm" className="ml-1">
                Wyloguj
              </Button>
            </form>
          </nav>

          {/* Mobile nav (hamburger) */}
          <MobileNav items={NAV_ITEMS} email={user.email ?? null} signOutAction={signOut} />
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <OnlineIndicator />
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-2.5 py-1.5 text-sm rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
    >
      {label}
    </Link>
  );
}
