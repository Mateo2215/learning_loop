"use client";

import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/shared/confirm-button";

export function DangerZone() {
  function notImplemented(action: string) {
    toast.warning(`${action} — operacja niewdrożona`, {
      description:
        "Aby usunąć konto / wyczyścić dane, skontaktuj się z administratorem lub usuń projekt z poziomu Supabase.",
    });
  }

  return (
    <section className="bg-bad/5 border border-bad/30 rounded-2xl p-6">
      <div className="flex items-start gap-3 mb-3">
        <AlertTriangle className="h-5 w-5 text-bad shrink-0 mt-0.5" />
        <div>
          <h3 className="font-serif text-[18px] font-medium leading-none text-bad">
            Strefa zagrożenia
          </h3>
          <p className="mt-2 text-[13px] text-muted leading-relaxed">
            Usunięcie konta jest nieodwracalne — wszystkie materiały, fiszki, oceny i historia
            powtórek znikną. Wyczyszczenie danych usuwa zawartość, ale zachowuje konto.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <ConfirmButton
          variant="outline"
          size="sm"
          onConfirm={() => notImplemented("Wyczyść wszystkie dane")}
          confirmLabel="Na pewno wyczyść?"
          className="border-bad/40 text-bad hover:bg-bad/10"
        >
          Wyczyść wszystkie dane
        </ConfirmButton>
        <ConfirmButton
          variant="outline"
          size="sm"
          onConfirm={() => notImplemented("Usuń konto")}
          confirmLabel="Na pewno usuń konto?"
          className="border-bad/40 text-bad hover:bg-bad/10"
        >
          Usuń konto
        </ConfirmButton>
      </div>
    </section>
  );
}
