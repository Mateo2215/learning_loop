"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Smartphone } from "lucide-react";

const MOBILE_LANDSCAPE_QUERY =
  "(orientation: landscape) and (max-height: 767px) and (pointer: coarse)";

type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: "portrait" | "portrait-primary") => Promise<void>;
};

type LockResult = "idle" | "pending" | "locked" | "rejected" | "unsupported";

interface OrientationDiagnostics {
  displayMode: string;
  orientationType: string;
  lockSupported: boolean;
  lockResult: LockResult;
  errorName: string | null;
  errorMessage: string | null;
}

const DISPLAY_MODES = ["fullscreen", "standalone", "minimal-ui", "browser"] as const;
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

function readDisplayMode(): string {
  if (typeof window === "undefined") return "unknown";
  return DISPLAY_MODES.find((mode) => window.matchMedia(`(display-mode: ${mode})`).matches) ?? "unknown";
}

function readOrientationType(): string {
  if (typeof screen === "undefined") return "unknown";
  return screen.orientation?.type ?? "unknown";
}

function hasOrientationLock(): boolean {
  if (typeof screen === "undefined") return false;
  const orientation = screen.orientation as LockableScreenOrientation | undefined;
  return typeof orientation?.lock === "function";
}

export function PortraitOrientationGuard() {
  const mobileLandscape = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [diagnostics, setDiagnostics] = useState<OrientationDiagnostics | null>(null);

  useEffect(() => {
    const debugEnabled = new URLSearchParams(window.location.search).get("pwaDebug") === "1";

    const updateDiagnostics = (lockResult: LockResult, err?: unknown) => {
      if (!debugEnabled) return;
      const error = err instanceof Error ? err : null;

      window.setTimeout(() => {
        setDiagnostics({
          displayMode: readDisplayMode(),
          orientationType: readOrientationType(),
          lockSupported: hasOrientationLock(),
          lockResult,
          errorName: error?.name ?? null,
          errorMessage: error?.message ?? null,
        });
      }, 0);
    };

    const lockPortrait = () => {
      if (typeof screen === "undefined") {
        updateDiagnostics("unsupported");
        return;
      }
      const orientation = screen.orientation as LockableScreenOrientation | undefined;
      if (!orientation?.lock) {
        updateDiagnostics("unsupported");
        return;
      }

      updateDiagnostics("pending");
      void orientation
        .lock("portrait-primary")
        .then(() => updateDiagnostics("locked"))
        .catch((err) => updateDiagnostics("rejected", err));
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

  const debugPanel = diagnostics ? (
    <div className="fixed inset-x-3 bottom-3 z-[110] rounded-lg border border-line bg-surface/95 p-3 text-left font-mono text-[11px] leading-relaxed text-fg shadow-lg">
      <div className="mb-1 font-sans text-[12px] font-medium">PWA orientation debug</div>
      <div>display-mode: {diagnostics.displayMode}</div>
      <div>orientation: {diagnostics.orientationType}</div>
      <div>lock supported: {String(diagnostics.lockSupported)}</div>
      <div>lock result: {diagnostics.lockResult}</div>
      {diagnostics.errorName && <div>error: {diagnostics.errorName}</div>}
      {diagnostics.errorMessage && <div>message: {diagnostics.errorMessage}</div>}
    </div>
  ) : null;

  if (!mobileLandscape) return debugPanel;

  return (
    <>
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
      {debugPanel}
    </>
  );
}
