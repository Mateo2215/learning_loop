"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Smartphone } from "lucide-react";

const MOBILE_LANDSCAPE_QUERY =
  "(orientation: landscape) and (max-height: 767px) and (pointer: coarse)";

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: "portrait" | "portrait-primary") => Promise<void>;
};

const LOCK_EVENTS = ["pointerdown", "touchend", "click", "keydown"] as const;

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  const media = window.matchMedia(MOBILE_LANDSCAPE_QUERY);
  media.addEventListener("change", onStoreChange);
  window.addEventListener("resize", onStoreChange);
  window.addEventListener("orientationchange", onStoreChange);

  return () => {
    media.removeEventListener("change", onStoreChange);
    window.removeEventListener("resize", onStoreChange);
    window.removeEventListener("orientationchange", onStoreChange);
  };
}

function getSnapshot() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_LANDSCAPE_QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

export function PortraitOrientationGuard() {
  const mobileLandscape = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    const lockPortrait = () => {
      if (typeof screen === "undefined") return;
      const orientation = screen.orientation as LockableScreenOrientation | undefined;
      void orientation?.lock?.("portrait-primary").catch(() => {
        // Some browsers only allow orientation lock for installed/fullscreen PWAs.
      });
    };

    lockPortrait();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") lockPortrait();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("orientationchange", lockPortrait);
    LOCK_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, lockPortrait, { capture: true, passive: true });
    });

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("orientationchange", lockPortrait);
      LOCK_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, lockPortrait, { capture: true });
      });
    };
  }, []);

  if (!mobileLandscape) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-canvas px-6 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-sm">
        <Smartphone className="mx-auto h-10 w-10 text-accent" aria-hidden="true" />
        <h2 className="mt-4 font-serif text-[26px] font-medium leading-tight text-fg">
          Tryb pionowy
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          Obróć telefon do pionu, żeby kontynuować naukę.
        </p>
      </div>
    </div>
  );
}
