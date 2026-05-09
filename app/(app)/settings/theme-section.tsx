"use client";

import { useTheme } from "@/lib/theme/provider";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export function ThemeSection() {
  const { autoSwitchEnabled, setAutoSwitchEnabled, resolvedTheme, theme, setTheme } = useTheme();

  return (
    <section className="bg-surface border border-line rounded-2xl p-6">
      <div className="mb-4">
        <h3 className="font-serif text-[18px] font-medium leading-none">Motyw</h3>
        <p className="mt-2 text-[13px] text-muted leading-relaxed">
          Przełącz między jasnym i ciemnym motywem, lub pozwól aplikacji ustawić go automatycznie po zmroku.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-canvas rounded-lg border border-line mb-3">
        <div>
          <div className="text-[13px] font-medium">Aktywny motyw</div>
          <div className="text-[11px] text-muted mt-0.5">
            <span className="font-mono">{resolvedTheme}</span>
            {autoSwitchEnabled && <span className="ml-1.5 text-accent">· auto</span>}
          </div>
        </div>
        <ThemeToggle />
      </div>

      <div className="flex gap-2 mb-4">
        {(["light", "dark", "system"] as const).map((opt) => {
          const active = theme === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => setTheme(opt)}
              className={
                "flex-1 px-3 py-2 rounded-lg border text-[12px] font-mono uppercase tracking-[0.15em] transition-colors " +
                (active
                  ? "border-accent/40 bg-accent-soft text-accent"
                  : "border-line bg-elevated text-muted hover:border-line-strong hover:text-fg")
              }
            >
              {opt === "light" ? "jasny" : opt === "dark" ? "ciemny" : "system"}
            </button>
          );
        })}
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-line-strong accent-accent"
          checked={autoSwitchEnabled}
          onChange={(e) => setAutoSwitchEnabled(e.target.checked)}
        />
        <span>
          <span className="text-[13px] font-medium">Automatycznie przełączaj na ciemny po 19:00</span>
          <span className="block text-[11px] text-muted mt-0.5 leading-relaxed">
            Wymusza ciemny tryb między 19:00 a 6:00, jasny w pozostałych godzinach. Gdy włączone, ręczny wybór motywu jest ignorowany.
          </span>
        </span>
      </label>
    </section>
  );
}
