"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Repeat, BarChart3, Menu } from "lucide-react";
import { isSessionRunPath, isPathInside } from "@/lib/nav/paths";
import { SessionPickerSheet } from "@/components/shared/session-picker-sheet";
import type { SessionCounts } from "@/lib/db/counts";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  Icon: typeof Home;
  match: (path: string) => boolean;
}

const ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Przegląd",
    Icon: Home,
    match: (p) => p === "/dashboard",
  },
  {
    href: "/materials",
    label: "Materiały",
    Icon: BookOpen,
    match: (p) => isPathInside(p, "/materials"),
  },
  {
    href: "/stats",
    label: "Statystyki",
    Icon: BarChart3,
    match: (p) => isPathInside(p, "/stats"),
  },
  {
    href: "/settings",
    label: "Menu",
    Icon: Menu,
    match: (p) => isPathInside(p, "/settings") || isPathInside(p, "/search"),
  },
];

// The "Sesje" tab is special: it opens a bottom-sheet picker instead of
// navigating, so it lives outside ITEMS. It sits between Materiały and Statystyki.
const SESSIONS_MATCH = (p: string) =>
  isPathInside(p, "/sessions") || isPathInside(p, "/gaps");

export function BottomNav() {
  const pathname = usePathname() ?? "";
  const [sheetOpen, setSheetOpen] = useState(false);
  const [counts, setCounts] = useState<SessionCounts | null>(null);

  // One fetch on mount; failures degrade silently (no badge, no toast).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/sessions/counts")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.auditsDue === "number") {
          setCounts(data as SessionCounts);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (isSessionRunPath(pathname)) return null;

  const sessionsActive = SESSIONS_MATCH(pathname);
  const badge = counts ? counts.auditsDue + counts.gapsOpen : 0;

  return (
    <>
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
        aria-label="Nawigacja dolna"
      >
        <ul className="grid grid-cols-5">
          <NavTab item={ITEMS[0]} active={ITEMS[0].match(pathname)} />
          <NavTab item={ITEMS[1]} active={ITEMS[1].match(pathname)} />

          {/* Sesje — opens the session picker sheet */}
          <li>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              className={cn(
                "w-full flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] transition-colors",
                sessionsActive ? "text-accent" : "text-muted",
              )}
            >
              <span className="relative">
                <Repeat className="h-5 w-5" strokeWidth={sessionsActive ? 2.25 : 1.75} />
                {badge > 0 && (
                  <span
                    className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 grid place-items-center rounded-full bg-bad text-white text-[10px] font-semibold leading-none tabular-nums"
                    aria-label={`${badge} do zrobienia`}
                  >
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </span>
              <span>Sesje</span>
            </button>
          </li>

          <NavTab item={ITEMS[2]} active={ITEMS[2].match(pathname)} />
          <NavTab item={ITEMS[3]} active={ITEMS[3].match(pathname)} />
        </ul>
      </nav>

      <SessionPickerSheet open={sheetOpen} onOpenChange={setSheetOpen} counts={counts} />
    </>
  );
}

function NavTab({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] transition-colors",
          active ? "text-accent" : "text-muted",
        )}
      >
        <item.Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
        <span>{item.label}</span>
      </Link>
    </li>
  );
}
