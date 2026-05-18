"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/shared/confirm-button";

export function DangerZone() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClearData() {
    setBusy(true);
    try {
      const res = await fetch("/api/user/clear-data", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error("Nie udało się wyczyścić danych", { description: body.error });
        return;
      }
      toast.success("Dane wyczyszczone", {
        description: "Materiały, fiszki, historia powtórek i koszty usunięte. Konto zachowane.",
      });
      router.refresh();
    } catch {
      toast.error("Błąd sieci — spróbuj ponownie");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAccount() {
    setBusy(true);
    try {
      const res = await fetch("/api/user/delete-account", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error("Nie udało się usunąć konta", { description: body.error });
        return;
      }
      router.push("/login");
    } catch {
      toast.error("Błąd sieci — spróbuj ponownie");
    } finally {
      setBusy(false);
    }
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
          disabled={busy}
          onConfirm={handleClearData}
          confirmLabel="Na pewno wyczyść?"
          className="border-bad/40 text-bad hover:bg-bad/10"
        >
          Wyczyść wszystkie dane
        </ConfirmButton>
        <ConfirmButton
          variant="outline"
          size="sm"
          disabled={busy}
          onConfirm={handleDeleteAccount}
          confirmLabel="Na pewno usuń konto?"
          className="border-bad/40 text-bad hover:bg-bad/10"
        >
          Usuń konto
        </ConfirmButton>
      </div>
    </section>
  );
}
