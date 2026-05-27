"use client";

import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { SESSION_NAV_ITEMS } from "@/lib/nav/session-items";
import type { SessionCounts } from "@/lib/db/counts";
import { cn } from "@/lib/utils";

/**
 * Mobile bottom sheet that lets the user pick a session type (Fiszki / Deep Dive
 * / Audyty / Luki wiedzy) instead of the old "Sesje" tab jumping straight into
 * flashcards. Controlled by BottomNav, which also owns the counts fetch.
 *
 * Reuses the Radix Dialog pattern from mobile-nav.tsx but anchors the panel to
 * the bottom edge with a slide-up animation.
 */
export function SessionPickerSheet({
  open,
  onOpenChange,
  counts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  counts: SessionCounts | null;
}) {
  const router = useRouter();

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out" />
        <Dialog.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-line bg-surface shadow-xl",
            "pb-[max(env(safe-area-inset-bottom),1rem)]",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom",
          )}
          aria-describedby={undefined}
        >
          <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-line" aria-hidden />
          <div className="px-4 pt-3 pb-1">
            <Dialog.Title className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              Wybierz rodzaj sesji
            </Dialog.Title>
          </div>
          <ul className="px-2 pb-2">
            {SESSION_NAV_ITEMS.map((item) => {
              const count = item.countKey && counts ? counts[item.countKey] : undefined;
              const highlight = item.href === "/sessions/review" && (count ?? 0) > 0;
              const countTone =
                count && count > 0 && item.alert ? "text-warn" : "text-muted";
              return (
                <li key={item.href}>
                  <button
                    type="button"
                    onClick={() => go(item.href)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                      "hover:bg-elevated focus-visible:outline-none focus-visible:bg-elevated",
                      highlight && "bg-accent-soft",
                    )}
                  >
                    <span
                      className={cn(
                        "shrink-0 grid place-items-center h-10 w-10 rounded-lg bg-elevated",
                        highlight ? "text-accent" : "text-subtle",
                      )}
                    >
                      <item.Icon className="h-5 w-5" strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium text-fg">{item.label}</span>
                      <span className="block text-[12px] text-muted truncate">{item.description}</span>
                    </span>
                    {count !== undefined && count > 0 && (
                      <span className={cn("shrink-0 font-mono text-[13px] tabular-nums", countTone)}>
                        {count}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
