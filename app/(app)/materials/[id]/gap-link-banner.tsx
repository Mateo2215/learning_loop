"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function GapLinkBanner({
  materialId,
  gapTitle,
}: {
  materialId: string;
  gapTitle: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"confirm" | "dismiss" | null>(null);

  async function act(action: "confirm" | "dismiss") {
    setBusy(action);
    try {
      const res = await fetch(`/api/materials/${materialId}/link-gap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Nie zapisano", { description: data.error ?? `HTTP ${res.status}` });
        return;
      }
      toast.success(action === "confirm" ? "Luka zamknięta" : "Sugestia odrzucona");
      router.refresh();
    } catch {
      toast.error("Błąd sieci");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="mb-4 border-accent bg-accent/10">
      <CardHeader>
        <CardTitle className="text-base">Czy ten materiał adresuje lukę?</CardTitle>
        <CardDescription>
          AI wykryło podobieństwo treści do otwartej luki: <strong>{gapTitle}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => act("confirm")} disabled={busy !== null}>
            {busy === "confirm" ? "Zapisuję…" : "Tak — zamknij lukę"}
          </Button>
          <Button variant="outline" onClick={() => act("dismiss")} disabled={busy !== null}>
            {busy === "dismiss" ? "…" : "Nie — odrzuć sugestię"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
