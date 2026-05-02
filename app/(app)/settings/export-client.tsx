"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ExportSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Export danych</CardTitle>
        <CardDescription>
          Pobierz wszystkie swoje materiały, fiszki, sesje, kalibracje i koszty jako jeden plik JSON. Embeddingi i identyfikatory użytkownika są pomijane.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild>
          <a href="/api/export/json" download>
            Pobierz jako JSON
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}
