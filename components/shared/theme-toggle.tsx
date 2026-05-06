"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme/provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Single-button light/dark toggle with cross-fading icons.
 * Auto-switch (force dark after 19:00) lives in /settings as a separate option.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={isDark ? "Włącz jasny motyw" : "Włącz ciemny motyw"}
      title={isDark ? "Jasny motyw" : "Ciemny motyw"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative h-9 w-9 p-0 rounded-md hover:bg-elevated active:scale-95 transition-transform",
        "focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        className
      )}
    >
      <Sun
        className={cn(
          "absolute h-4 w-4 transition-all duration-300",
          isDark ? "scale-0 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"
        )}
      />
      <Moon
        className={cn(
          "absolute h-4 w-4 transition-all duration-300",
          isDark ? "scale-100 rotate-0 opacity-100" : "scale-0 -rotate-90 opacity-0"
        )}
      />
    </Button>
  );
}
