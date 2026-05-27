"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { NavigationMenu as Nm } from "radix-ui";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { MobileNav } from "@/components/shared/mobile-nav";
import { isSessionRunPath, isPathInside } from "@/lib/nav/paths";
import { SESSION_NAV_ITEMS } from "@/lib/nav/session-items";
import { cn } from "@/lib/utils";

interface SubItem {
  href: string;
  label: string;
  description?: string;
}

export interface TopNavProps {
  email: string | null;
  signOutAction: () => Promise<void>;
}

// Shared with the mobile bottom-sheet picker — single source of truth.
const SESSIONS_SUB: SubItem[] = SESSION_NAV_ITEMS.map(({ href, label, description }) => ({
  href,
  label,
  description,
}));

const MENU_SUB: SubItem[] = [
  { href: "/search", label: "Wyszukaj", description: "Pełnotekstowe + semantyczne" },
  { href: "/settings", label: "Ustawienia", description: "Motyw, eksport, konto" },
  { href: "/costs", label: "Koszty", description: "Zużycie API miesięcznie" },
];

const MOBILE_ITEMS: SubItem[] = [
  { href: "/dashboard", label: "Przegląd" },
  { href: "/materials", label: "Materiały" },
  ...SESSIONS_SUB,
  { href: "/stats", label: "Statystyki" },
  ...MENU_SUB,
];

export function TopNav({ email, signOutAction }: TopNavProps) {
  const pathname = usePathname() ?? "";

  if (isSessionRunPath(pathname)) {
    return null;
  }

  const dashActive = pathname === "/dashboard";
  const matActive = isPathInside(pathname, "/materials");
  const sesjeActive =
    isPathInside(pathname, "/sessions") || isPathInside(pathname, "/gaps");
  const statsActive = isPathInside(pathname, "/stats");
  const menuActive =
    isPathInside(pathname, "/search") || isPathInside(pathname, "/settings");

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur">
      <div className="max-w-[1024px] mx-auto px-6 h-14 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="font-serif text-[18px] font-medium tracking-tight transition-opacity hover:opacity-80"
        >
          Learning <span className="text-accent">Loop</span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-1">
          <Nm.Root delayDuration={80} skipDelayDuration={200} className="relative">
            <Nm.List className="flex items-center gap-1">
              <NavLinkItem href="/dashboard" label="Przegląd" active={dashActive} />
              <NavLinkItem href="/materials" label="Materiały" active={matActive} />
              <NavDropdown label="Sesje" active={sesjeActive} items={SESSIONS_SUB} pathname={pathname} />
              <NavLinkItem href="/stats" label="Statystyki" active={statsActive} />
              <NavDropdown label="Menu" active={menuActive} items={MENU_SUB} pathname={pathname}>
                <li className="my-1 mx-1 h-px bg-line" />
                <li>
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="w-full text-left rounded-md px-3 py-2 text-[13px] text-fg transition-colors hover:bg-elevated"
                    >
                      Wyloguj
                    </button>
                  </form>
                </li>
              </NavDropdown>
            </Nm.List>

            {/* Floating viewport — single shared container for all submenus.
                Eliminates flicker because moving from trigger to viewport never
                leaves an open NavigationMenu sub-tree. */}
            <div className="absolute top-full right-0 flex justify-end pt-2">
              <Nm.Viewport
                className={cn(
                  "relative origin-top overflow-hidden rounded-lg border border-line bg-surface shadow-lg shadow-black/10 dark:shadow-black/40",
                  "h-[var(--radix-navigation-menu-viewport-height)] w-[var(--radix-navigation-menu-viewport-width)] transition-[width,height] duration-200",
                  "data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95",
                  "data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95"
                )}
              />
            </div>
          </Nm.Root>

          <div className="ml-2 pl-2 border-l border-line">
            <ThemeToggle />
          </div>
        </div>

        {/* Mobile hamburger */}
        <MobileNav items={MOBILE_ITEMS} email={email} signOutAction={signOutAction} />
      </div>
    </header>
  );
}

function NavLinkItem({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Nm.Item>
      <Nm.Link asChild active={active}>
        <Link
          href={href}
          className={cn(
            "relative inline-block px-3 py-2 text-[13px] rounded-md transition-colors",
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
      </Nm.Link>
    </Nm.Item>
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
    <Nm.Item>
      <Nm.Trigger
        className={cn(
          "group relative inline-flex items-center gap-1 px-3 py-2 text-[13px] rounded-md transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
          "data-[state=open]:bg-elevated data-[state=open]:text-fg",
          active
            ? "text-fg font-medium bg-elevated/60"
            : "text-subtle hover:text-fg hover:bg-elevated"
        )}
      >
        {label}
        <ChevronDown
          className="h-3.5 w-3.5 opacity-60 transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden
        />
        {active && (
          <span className="absolute inset-x-3 -bottom-[1px] h-0.5 rounded-full bg-accent" />
        )}
      </Nm.Trigger>
      <Nm.Content
        className={cn(
          "p-2 min-w-[18rem]",
          "data-[motion=from-start]:animate-in data-[motion=from-start]:slide-in-from-left-2",
          "data-[motion=from-end]:animate-in data-[motion=from-end]:slide-in-from-right-2",
          "data-[motion=to-start]:animate-out data-[motion=to-start]:slide-out-to-left-2",
          "data-[motion=to-end]:animate-out data-[motion=to-end]:slide-out-to-right-2"
        )}
      >
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => {
            const itemActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Nm.Link asChild active={itemActive}>
                  <Link
                    href={item.href}
                    className={cn(
                      "block rounded-md px-3 py-2 transition-colors",
                      "hover:bg-elevated focus-visible:outline-none focus-visible:bg-elevated",
                      itemActive && "bg-accent-soft"
                    )}
                  >
                    <div
                      className={cn(
                        "text-[13px] font-medium",
                        itemActive ? "text-accent" : "text-fg"
                      )}
                    >
                      {item.label}
                    </div>
                    {item.description && (
                      <div className="text-xs text-muted mt-0.5">{item.description}</div>
                    )}
                  </Link>
                </Nm.Link>
              </li>
            );
          })}
          {children}
        </ul>
      </Nm.Content>
    </Nm.Item>
  );
}
