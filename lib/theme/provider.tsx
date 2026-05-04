"use client";

/**
 * Lightweight theme provider — light/dark/system without the next-themes
 * dependency. Persists to localStorage["theme"], applies `data-theme="dark"`
 * to <html> in dark mode, and updates `<meta name="theme-color">` so PWA
 * status bars match.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeChoice;
  resolvedTheme: ResolvedTheme;
  setTheme: (next: ThemeChoice) => void;
  /** Whether the auto-switch (force dark after 19:00 when "system") is enabled. */
  autoSwitchEnabled: boolean;
  setAutoSwitchEnabled: (next: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "theme";
const AUTO_SWITCH_KEY = "theme_auto_switch";
const AUTO_SWITCH_HOUR = 19;

const META_COLORS: Record<ResolvedTheme, string> = {
  light: "#fafafa",
  dark: "#0a0a0a",
};

function readStoredTheme(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

function readAutoSwitch(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(AUTO_SWITCH_KEY) === "true";
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveTheme(choice: ThemeChoice, autoSwitch: boolean): ResolvedTheme {
  if (choice === "light") return "light";
  if (choice === "dark") return "dark";
  // system
  if (autoSwitch) {
    const hour = new Date().getHours();
    if (hour >= AUTO_SWITCH_HOUR || hour < 6) return "dark";
  }
  return systemPrefersDark() ? "dark" : "light";
}

function applyResolved(resolved: ResolvedTheme): void {
  const html = document.documentElement;
  if (resolved === "dark") html.setAttribute("data-theme", "dark");
  else html.removeAttribute("data-theme");

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", META_COLORS[resolved]);
  else {
    const m = document.createElement("meta");
    m.name = "theme-color";
    m.content = META_COLORS[resolved];
    document.head.appendChild(m);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Default state matches the SSR-rendered <html> attribute (no data-theme = light).
  // After hydration we read storage + system preference and re-apply.
  const [theme, setThemeState] = useState<ThemeChoice>("system");
  const [autoSwitchEnabled, setAutoSwitchEnabledState] = useState(false);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from storage on mount
  useEffect(() => {
    const stored = readStoredTheme();
    const auto = readAutoSwitch();
    const resolved = resolveTheme(stored, auto);
    setThemeState(stored);
    setAutoSwitchEnabledState(auto);
    setResolvedTheme(resolved);
    applyResolved(resolved);
    setHydrated(true);
  }, []);

  // Listen for OS theme changes when in 'system' mode
  useEffect(() => {
    if (!hydrated) return;
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const resolved = resolveTheme("system", autoSwitchEnabled);
      setResolvedTheme(resolved);
      applyResolved(resolved);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [hydrated, theme, autoSwitchEnabled]);

  // Re-evaluate every 5 minutes so auto-switch flips at 19:00 without a refresh
  useEffect(() => {
    if (!hydrated) return;
    if (theme !== "system" || !autoSwitchEnabled) return;
    const interval = setInterval(() => {
      const resolved = resolveTheme("system", true);
      setResolvedTheme((prev) => {
        if (prev !== resolved) applyResolved(resolved);
        return resolved;
      });
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [hydrated, theme, autoSwitchEnabled]);

  const setTheme = useCallback(
    (next: ThemeChoice) => {
      window.localStorage.setItem(STORAGE_KEY, next);
      setThemeState(next);
      const resolved = resolveTheme(next, autoSwitchEnabled);
      setResolvedTheme(resolved);
      applyResolved(resolved);
    },
    [autoSwitchEnabled]
  );

  const setAutoSwitchEnabled = useCallback(
    (next: boolean) => {
      window.localStorage.setItem(AUTO_SWITCH_KEY, String(next));
      setAutoSwitchEnabledState(next);
      const resolved = resolveTheme(theme, next);
      setResolvedTheme(resolved);
      applyResolved(resolved);
    },
    [theme]
  );

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme, setTheme, autoSwitchEnabled, setAutoSwitchEnabled }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

/**
 * Inline script string injected into <head> before hydration to set the right
 * data-theme synchronously. Prevents the FOUC (flash of light theme on dark
 * users' machines).
 */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('${STORAGE_KEY}');var a=localStorage.getItem('${AUTO_SWITCH_KEY}')==='true';var resolved;if(s==='light'){resolved='light'}else if(s==='dark'){resolved='dark'}else{var h=new Date().getHours();if(a&&(h>=${AUTO_SWITCH_HOUR}||h<6)){resolved='dark'}else{resolved=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}}if(resolved==='dark'){document.documentElement.setAttribute('data-theme','dark')}}catch(e){}})();`;
