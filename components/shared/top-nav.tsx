"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { MobileNav } from "@/components/shared/mobile-nav";
import { isSessionRunPath, isPathInside } from "@/lib/nav/paths";
import { cn } from "@/lib/utils";

interface SubItem {
  href: string;
  label: string;
}

export interface TopNavProps {
  email: string | null;
  signOutAction: () => Promise<void>;
}

const SESSIONS_SUB: SubItem[] = [
  { href: "/sessions/review", label: "Review (FSRS)" },
  { href: "/sessions/deep-dive", label: "Deep Dive" },
  { href: "/sessions/audit", label: "Audyty" },
];

const MENU_SUB: SubItem[] = [
  { href: "/gaps", label: "Luki wiedzy" },
  { href: "/search", label: "Wyszukaj" },
  { href: "/settings", label: "Ustawienia" },
];

// All flat items used by the mobile drawer (so user has full reach in one list).
const MOBILE_ITEMS: SubItem[] = [
  { href: "/dashboard", label: "Dziś" },
  { href: "/materials", label: "Materiały" },
  ...SESSIONS_SUB,
  ...MENU_SUB,
];

export function TopNav({ email, signOutAction }: TopNavProps) {
  const pathname = usePathname() ?? "";

  if (isSessionRunPath(pathname)) {
    // Sesja w toku — chrome-less.
    return null;
  }

  const dziśActive = pathname === "/dashboard";
  const matActive = isPathInside(pathname, "/materials");
  const sesjeActive = isPathInside(pathname, "/sessions");
  const menuActive =
    isPathInside(pathname, "/gaps") ||
    isPathInside(pathname, "/search") ||
    isPathInside(pathname, "/settings");

  return (
    <header className="border-b border-line bg-surface sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="font-serif text-base font-medium">
          Learning Loop
        </Link>

        {/* Desktop */}
        <nav className="hidden md:flex items-center gap-1">
          <NavLink href="/dashboard" label="Dziś" active={dziśActive} />
          <NavLink href="/materials" label="Materiały" active={matActive} />
          <NavDropdown label="Sesje" active={sesjeActive} items={SESSIONS_SUB} pathname={pathname} />
          <NavDropdown label="Menu" active={menuActive} items={MENU_SUB} pathname={pathname}>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <form action={signOutAction} className="w-full">
                <button type="submit" className="w-full text-left text-sm">
                  Wyloguj
                </button>
              </form>
            </DropdownMenuItem>
          </NavDropdown>
          <ThemeToggle />
        </nav>

        {/* Mobile hamburger */}
        <MobileNav items={MOBILE_ITEMS} email={email} signOutAction={signOutAction} />
      </div>
    </header>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "px-3 py-1.5 text-sm rounded-md transition-colors relative",
        active ? "text-fg" : "text-muted hover:text-fg hover:bg-elevated"
      )}
    >
      {label}
      {active && <span className="absolute inset-x-3 -bottom-[15px] h-0.5 bg-accent" />}
    </Link>
  );
}

function NavDropdown({
  label,
  active,
  items,
  pathname,
  children,
}: {
  label: string;
  active: boolean;
  items: SubItem[];
  pathname: string;
  children?: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "px-3 py-1.5 h-auto text-sm relative",
            active ? "text-fg" : "text-muted hover:text-fg"
          )}
        >
          {label}
          <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
          {active && <span className="absolute inset-x-3 -bottom-[15px] h-0.5 bg-accent" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {items.map((item) => {
          const itemActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <DropdownMenuItem key={item.href} asChild>
              <Link
                href={item.href}
                className={cn("text-sm w-full", itemActive && "text-accent")}
              >
                {item.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
