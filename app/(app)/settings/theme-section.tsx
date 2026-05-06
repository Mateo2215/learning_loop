"use client";

import { useTheme } from "@/lib/theme/provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export function ThemeSection() {
  const { autoSwitchEnabled, setAutoSwitchEnabled, resolvedTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Motyw</CardTitle>
        <CardDescription>
          Przełącz między jasnym i ciemnym motywem, lub pozwól aplikacji ustawić go automatycznie po zmroku.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium">Motyw</div>
            <div className="text-xs text-muted">
              aktualnie aktywny: <span className="font-mono">{resolvedTheme}</span>
              {autoSwitchEnabled && <span className="ml-1 text-accent">· auto</span>}
            </div>
          </div>
          <ThemeToggle />
        </div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-line-strong accent-accent"
            checked={autoSwitchEnabled}
            onChange={(e) => setAutoSwitchEnabled(e.target.checked)}
          />
          <span>
            <span className="font-medium">Automatycznie przełączaj na ciemny po 19:00</span>
            <span className="block text-xs text-muted">
              Wymusza ciemny tryb między 19:00 a 6:00, jasny w pozostałych godzinach.
              Gdy włączone, ręczny wybór motywu jest ignorowany.
            </span>
          </span>
        </label>
      </CardContent>
    </Card>
  );
}
