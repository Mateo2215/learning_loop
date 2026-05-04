"use client";

import { useTheme } from "@/lib/theme/provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export function ThemeSection() {
  const { autoSwitchEnabled, setAutoSwitchEnabled, theme, resolvedTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Motyw</CardTitle>
        <CardDescription>
          Wybierz jasny, ciemny lub zgodny z systemem operacyjnym.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium">Wybór motywu</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              aktualnie aktywny: <span className="font-mono">{resolvedTheme}</span>{" "}
              ({theme === "system" ? "z systemu" : "wymuszony"})
            </div>
          </div>
          <ThemeToggle />
        </div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
            checked={autoSwitchEnabled}
            onChange={(e) => setAutoSwitchEnabled(e.target.checked)}
            disabled={theme !== "system"}
          />
          <span>
            <span className="font-medium">Auto-switch na ciemny po 19:00</span>
            <span className="block text-xs text-zinc-500 dark:text-zinc-400">
              Aktywne tylko gdy motyw jest ustawiony na &ldquo;systemowy&rdquo;. Wymusza ciemny
              tryb między 19:00 a 6:00 niezależnie od preferencji systemu.
            </span>
          </span>
        </label>
      </CardContent>
    </Card>
  );
}
