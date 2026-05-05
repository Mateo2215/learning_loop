"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root error boundary:", error);
  }, [error]);

  return (
    <html lang="pl">
      <body className="min-h-[100dvh] flex items-center justify-center p-6 bg-canvas text-fg">
        <div className="max-w-md flex flex-col gap-4 text-center">
          <h1 className="text-2xl font-semibold">Coś poszło nie tak</h1>
          <p className="text-sm text-muted">
            Aplikacja napotkała nieoczekiwany błąd. Spróbuj ponownie lub wróć do panelu.
          </p>
          {error.digest && (
            <p className="text-xs text-muted font-mono">digest: {error.digest}</p>
          )}
          <div className="flex gap-2 justify-center">
            <Button onClick={reset}>Spróbuj ponownie</Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </div>
      </body>
    </html>
  );
}
