"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Repeat, BarChart3, Menu } from "lucide-react";
import { isSessionRunPath, isPathInside } from "@/lib/nav/paths";
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
    href: "/sessions/review",
    label: "Sesje",
    Icon: Repeat,
    match: (p) => isPathInside(p, "/sessions") || isPathInside(p, "/gaps"),
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

export function BottomNav() {
  const pathname = usePathname() ?? "";
  if (isSessionRunPath(pathname)) return null;

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]"
      aria-label="Nawigacja dolna"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] transition-colors",
                  active ? "text-accent" : "text-muted"
                )}
              >
                <item.Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
