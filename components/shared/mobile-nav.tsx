"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";

interface NavItem {
  href: string;
  label: string;
}

/**
 * Mobile-only hamburger drawer. Renders the same nav links as the desktop bar
 * but as a vertical list inside a Radix Dialog with a side-sheet animation.
 * `signOutAction` is the same server action passed down from layout.tsx.
 */
export function MobileNav({
  items,
  email,
  signOutAction,
}: {
  items: NavItem[];
  email: string | null;
  signOutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Otwórz menu"
          className="md:hidden h-9 w-9 p-0"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed inset-y-0 right-0 z-50 w-72 max-w-[85vw] bg-surface border-l border-line shadow-xl flex flex-col pb-[env(safe-area-inset-bottom)]"
          aria-describedby={undefined}
        >
          <div className="flex items-center justify-between px-4 h-14 border-b border-line">
            <Dialog.Title className="font-semibold text-sm">Menu</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" aria-label="Zamknij" className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>
          <nav className="flex-1 overflow-y-auto py-2">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center px-4 py-3 text-sm hover:bg-elevated transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="border-t border-line px-4 py-3 space-y-3">
            {email && (
              <div className="text-[10px] uppercase tracking-wide text-muted font-mono truncate">
                {email}
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <ThemeToggle />
              <form action={signOutAction}>
                <Button type="submit" variant="outline" size="sm">
                  Wyloguj
                </Button>
              </form>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
