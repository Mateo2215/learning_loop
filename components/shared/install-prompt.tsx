"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * PWA install prompt banner. Listens for `beforeinstallprompt` (Chrome/Edge)
 * and surfaces a small CTA. iOS Safari doesn't fire that event — for those
 * users we show a 1-line hint with the manual "Share → Add to Home Screen"
 * instruction. Dismissal is sticky for 30 days.
 */

const DISMISS_KEY = "install_dismissed_at";
const DISMISS_DAYS = 30;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function dismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!ts) return false;
    return Date.now() - ts < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari uses navigator.standalone
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;
    if (dismissedRecently()) return;
    setDismissed(false);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    if (isIos()) setShowIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* noop */
    }
    setDismissed(true);
    setDeferred(null);
    setShowIosHint(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome !== "dismissed") dismiss();
    setDeferred(null);
  }

  if (dismissed) return null;
  if (!deferred && !showIosHint) return null;

  return (
    <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-3 sm:max-w-sm z-40 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-lg p-3">
      <div className="flex items-start gap-3">
        <Download className="h-5 w-5 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <div className="flex-1 text-sm">
          {deferred ? (
            <>
              <div className="font-medium">Zainstaluj Learning Loop</div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                Działa offline, otwiera się jak natywna aplikacja.
              </div>
            </>
          ) : (
            <>
              <div className="font-medium">Dodaj do ekranu domowego</div>
              <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                Tap <span className="font-mono">Udostępnij</span> →{" "}
                <span className="font-mono">Do ekranu początkowego</span>.
              </div>
            </>
          )}
          {deferred && (
            <Button size="sm" className="mt-2 h-8" onClick={install}>
              Zainstaluj
            </Button>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 -mt-1 -mr-1"
          aria-label="Zamknij"
          onClick={dismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
