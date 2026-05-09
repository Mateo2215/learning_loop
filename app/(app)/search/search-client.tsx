"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/db/types";

interface SearchResult {
  id: string;
  title: string;
  category: Category;
  tags: string[] | null;
  status: "processing" | "ready" | "failed";
  imported_at: string;
  snippet: string | null;
}

const STATUS_OPTIONS = [
  { value: "ready", label: "Gotowy" },
  { value: "processing", label: "W trakcie" },
  { value: "failed", label: "Błąd" },
] as const;

export function SearchClient({ availableTags }: { availableTags: string[] }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState<"" | "ready" | "processing" | "failed">("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (category) params.set("category", category);
      if (tag) params.set("tag", tag);
      if (status) params.set("status", status);
      const res = await fetch(`/api/search?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setResults([]);
        return;
      }
      setResults(data.results as SearchResult[]);
    } finally {
      setLoading(false);
    }
  }, [q, category, tag, status]);

  // Debounce: re-run search 250ms after the last input change. Skip the very
  // first render so we don't fetch on mount with empty filters.
  useEffect(() => {
    if (!hasSearched && !q && !category && !tag && !status) return;
    const t = setTimeout(() => void runSearch(), 250);
    return () => clearTimeout(t);
  }, [q, category, tag, status, runSearch, hasSearched]);

  function clearFilters() {
    setQ("");
    setCategory("");
    setTag("");
    setStatus("");
  }

  const anyFilter = q || category || tag || status;

  return (
    <>
      <Card className="mb-6">
        <CardContent className="pt-6 space-y-3">
          <Input
            placeholder="Wpisz frazę…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              className="h-9 rounded-md border border-line bg-transparent px-3 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value as Category | "")}
            >
              <option value="">Wszystkie kategorie</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-line bg-transparent px-3 text-sm"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              disabled={availableTags.length === 0}
            >
              <option value="">Wszystkie tagi</option>
              {availableTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-line bg-transparent px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              <option value="">Wszystkie statusy</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {anyFilter && (
            <div className="flex justify-end">
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                Wyczyść
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {loading && <p className="text-sm text-muted">Szukam…</p>}

      {!loading && hasSearched && results.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brak wyników</CardTitle>
            <CardDescription>Spróbuj innej frazy lub usuń filtry.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-3">
          {results.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  <Link href={`/materials/${r.id}`} className="hover:underline">
                    {r.title}
                  </Link>
                </CardTitle>
                <CardDescription>
                  {CATEGORY_LABELS[r.category]} ·{" "}
                  {new Date(r.imported_at).toLocaleDateString("pl-PL")} ·{" "}
                  {r.status === "ready" ? "Gotowy" : r.status === "processing" ? "W trakcie" : "Błąd"}
                </CardDescription>
              </CardHeader>
              {(r.snippet || (r.tags && r.tags.length > 0)) && (
                <CardContent className="space-y-2 text-sm">
                  {r.snippet && (
                    <p className="text-subtle whitespace-pre-wrap">
                      {r.snippet}
                    </p>
                  )}
                  {r.tags && r.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {r.tags.map((t, i) => (
                        <span
                          key={`${t}-${i}`}
                          className="text-xs px-2 py-0.5 rounded-md bg-elevated text-muted"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
