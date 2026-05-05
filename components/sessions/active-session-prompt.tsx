"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ActiveSessionInfo } from "@/lib/sessions/start-client";

const MODE_LABEL: Record<ActiveSessionInfo["mode"], string> = {
  review: "Review",
  deep_dive: "Deep Dive",
  audit: "Audyt",
};

function formatStarted(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min} min temu`;
  const h = Math.round(min / 60);
  return `${h} h temu`;
}

export interface ActiveSessionPromptProps {
  active: ActiveSessionInfo;
  onTakeOver: () => void;
  onCancel: () => void;
  takingOver?: boolean;
}

export function ActiveSessionPrompt({ active, onTakeOver, onCancel, takingOver }: ActiveSessionPromptProps) {
  const device = active.device ?? "innym urządzeniu";
  return (
    <Card>
      <CardHeader>
        <CardTitle>Aktywna sesja na innym urządzeniu</CardTitle>
        <CardDescription>
          {MODE_LABEL[active.mode]} rozpoczęty {formatStarted(active.started_at)} ({device}). Nie możesz
          prowadzić dwóch sesji równolegle.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row gap-2">
        <Button onClick={onTakeOver} disabled={takingOver} className="min-h-12">
          {takingOver ? "Przejmuję…" : "Przejmij tutaj"}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={takingOver} className="min-h-12">
          Wróć
        </Button>
      </CardContent>
    </Card>
  );
}
