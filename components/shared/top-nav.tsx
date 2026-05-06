"use client";

import { useRef, useState } from "react";
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

const MOBILE_ITEMS: SubItem[] = [
  { href: "/dashboard", label: "Dziś" },
  { href: "/materials", label: "Materiały" },
  ...SESSIONS_SUB,
  ...MENU_SUB,
];

export function TopNav({ email, signOutAction }: TopNavProps) {
  const pathname = usePathname() ?? "";

  if (isSessionRunPath(pathname)) {
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
    <header className="sticky top-0 z-30 border-b border-line/60 bg-surface/80 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="font-serif text-lg font-medium tracking-tight transition-opacity hover:opacity-80"
        >
          Learning <span className="text-accent">Loop</span>
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
          <div className="ml-2 pl-2 border-l border-line">
            <ThemeToggle />
          </div>
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
        "relative px-3 py-2 text-sm rounded-md transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        active
          ? "text-fg font-medium bg-elevated/60"
          : "text-subtle hover:text-fg hover:bg-elevated"
      )}
    >
      {label}
      {active && (
        <span className="absolute inset-x-3 -bottom-[1px] h-0.5 rounded-full bg-accent" />
      )}
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
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const handleEnter = () => {
    cancelClose();
    setOpen(true);
  };

  const handleLeave = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div onMouseEnter={handleEnter} onMouseLeave={handleLeave} className="relative">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "relative px-3 py-2 h-auto text-sm rounded-md transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
              "data-[state=open]:bg-elevated data-[state=open]:text-fg",
              active
                ? "text-fg font-medium bg-elevated/60"
                : "text-subtle hover:text-fg hover:bg-elevated"
            )}
          >
            {label}
            <ChevronDown
              className={cn(
                "ml-1 h-3.5 w-3.5 opacity-60 transition-transform duration-200",
                open && "rotate-180"
              )}
            />
            {active && (
              <span className="absolute inset-x-3 -bottom-[1px] h-0.5 rounded-full bg-accent" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sideOffset={8}
          className="min-w-48"
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          {items.map((item) => {
            const itemActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <DropdownMenuItem key={item.href} asChild>
                <Link
                  href={item.href}
                  className={cn(
                    "text-sm w-full",
                    itemActive && "text-accent font-medium bg-accent-soft"
                  )}
                >
                  {item.label}
                </Link>
              </DropdownMenuItem>
            );
          })}
          {children}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
