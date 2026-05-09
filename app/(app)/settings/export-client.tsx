"use client";

import { Download } from "lucide-react";

export function ExportSection() {
  return (
    <section className="bg-surface border border-line rounded-2xl p-6">
      <h3 className="font-serif text-[18px] font-medium leading-none">Eksport danych</h3>
      <p className="mt-2 text-[13px] text-muted leading-relaxed">
        Pobierz wszystkie swoje materiały, fiszki, sesje, kalibracje i koszty jako jeden plik JSON.
        Embeddingi i identyfikatory użytkownika są pomijane.
      </p>
      <a
        href="/api/export/json"
        download
        className="mt-4 inline-flex items-center gap-2 bg-elevated border border-line rounded-lg px-4 py-2.5 text-[13px] font-medium hover:border-line-strong transition-colors"
      >
        <Download className="h-4 w-4" />
        Pobierz jako JSON
      </a>
    </section>
  );
}
