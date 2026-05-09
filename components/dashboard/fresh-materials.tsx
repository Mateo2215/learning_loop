import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

interface FreshMaterial {
  id: string;
  title: string;
  imported_at: string;
  item_count: number;
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min} min temu`;
  const h = Math.round(min / 60);
  return `${h} h temu`;
}

/**
 * Świeże materiały — items zaimportowane w ostatnich 24h, bez ukończonej sesji.
 * Jeden tap → Deep Dive. Zwraca null gdy lista pusta (parent renderuje fallback).
 */
export async function FreshMaterials() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, imported_at")
    .is("deleted_at", null)
    .eq("status", "ready")
    .gte("imported_at", since)
    .order("imported_at", { ascending: false })
    .limit(10);

  if (!materials || materials.length === 0) return null;

  const ids = materials.map((m) => m.id);
  const { data: touched } = await supabase
    .from("reviews")
    .select("material_id")
    .eq("user_id", user.id)
    .in("material_id", ids);

  const touchedSet = new Set((touched ?? []).map((r) => r.material_id as string));
  const fresh = materials.filter((m) => !touchedSet.has(m.id));
  if (fresh.length === 0) return null;

  const { data: itemRows } = await supabase
    .from("items")
    .select("material_id")
    .eq("user_id", user.id)
    .in("material_id", fresh.map((m) => m.id))
    .is("audit_id", null);

  const counts = new Map<string, number>();
  for (const row of itemRows ?? []) {
    const id = (row as { material_id: string }).material_id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const list: FreshMaterial[] = fresh.map((m) => ({
    id: m.id,
    title: m.title,
    imported_at: m.imported_at,
    item_count: counts.get(m.id) ?? 0,
  }));

  return (
    <section>
      <div className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted mb-4">
        Świeże materiały
      </div>
      <ul className="rounded-xl border border-line bg-surface divide-y divide-line overflow-hidden">
        {list.map((m) => (
          <li
            key={m.id}
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-5 py-4 hover:bg-elevated transition-colors"
          >
            <div className="min-w-0">
              <Link
                href={`/materials/${m.id}`}
                className="font-serif text-[18px] tracking-[-0.005em] text-fg hover:text-accent transition-colors block truncate"
              >
                {m.title}
              </Link>
              <div className="text-muted text-[12px] font-mono uppercase tracking-[0.15em] mt-1">
                {formatRelative(m.imported_at)} · {m.item_count} pytań
              </div>
            </div>
            <Link
              href={`/sessions/deep-dive/${m.id}`}
              className="inline-flex items-center gap-2 text-accent text-[13px] font-medium hover:opacity-80 transition-opacity self-start md:self-auto"
            >
              Zacznij Deep Dive
              <ArrowRight className="h-4 w-4" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
