"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeChoice } from "@/lib/theme/provider";
import { Button } from "@/components/ui/button";

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Jasny", Icon: Sun },
  { value: "dark", label: "Ciemny", Icon: Moon },
  { value: "system", label: "Systemowy", Icon: Monitor },
];

/**
 * Compact 3-state toggle — light / dark / system. Used in the nav bar.
 * Falls back to a single button cycling through options on small viewports.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Motyw"
      className="inline-flex items-center rounded-md border border-line p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <Button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            variant={active ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setTheme(value)}
            className="h-7 w-7 p-0"
          >
            <Icon className="h-3.5 w-3.5" />
          </Button>
        );
      })}
    </div>
  );
}
