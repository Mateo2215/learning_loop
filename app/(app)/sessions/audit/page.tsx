import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getDueAudits,
  enrollMasteredMaterials,
  AUDIT_SESSION_SIZE,
  AUDIT_QUESTIONS_PER_MATERIAL,
  type DueAudit,
} from "@/lib/audits/scheduler";
import { SectionHeader } from "@/components/shared/section-header";
import { cn } from "@/lib/utils";

interface UpcomingRow {
  id: string;
  material_id: string;
  audit_round: number | null;
  scheduled_for: string;
  materials: { title: string } | { title: string }[] | null;
}

interface CompletedRow {
  id: string;
  material_id: string;
  audit_round: number | null;
  completed_at: string | null;
  performance_score: number | string | null;
  materials: { title: string } | { title: string }[] | null;
}

function getTitle(row: { materials: { title: string } | { title: string }[] | null }): string {
  const m = row.materials;
  if (!m) return "(materiał usunięty)";
  return Array.isArray(m) ? m[0]?.title ?? "(materiał usunięty)" : m.title;
}

function roundLabel(round: number | null): string {
  return `Audyt #${round ?? 1}`;
}

function daysBetween(iso: string, now = Date.now()): number {
  const ms = new Date(iso).getTime() - now;
  return Math.round(Math.abs(ms) / (24 * 60 * 60 * 1000));
}

function formatDatePl(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", { day: "2-digit", month: "long" });
}

function scoreTone(score: number): string {
  if (score < 0.6) return "text-bad bg-bad/10";
  if (score < 0.8) return "text-warn bg-warn/10";
  return "text-ok bg-ok/10";
}

export default async function AuditsListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Bootstrap: dopnij round-1 audyty opanowanym materiałom bez pending audytu.
  // Idempotentne; błąd nie blokuje renderu listy.
  try {
    await enrollMasteredMaterials(supabase, user.id);
  } catch {
    // best-effort
  }

  let due: DueAudit[];
  try {
    due = await getDueAudits(supabase, user.id, 50);
  } catch {
    due = [];
  }

  const nowIso = new Date().toISOString();

  const [{ data: upcomingRows }, { data: completedRows }] = await Promise.all([
    supabase
      .from("topic_audits")
      .select("id, material_id, audit_round, scheduled_for, materials!inner(title)")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .gt("scheduled_for", nowIso)
      .order("scheduled_for", { ascending: true })
      .limit(15),
    supabase
      .from("topic_audits")
      .select("id, material_id, audit_round, completed_at, performance_score, materials!inner(title)")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(10),
  ]);

  const upcoming = (upcomingRows ?? []) as UpcomingRow[];
  const completed = (completedRows ?? []) as CompletedRow[];

  const sessionSize = Math.min(due.length, AUDIT_SESSION_SIZE);

  return (
    <div className="max-w-[1024px] mx-auto px-6 py-10">
      <SectionHeader
        title="Audyty"
        sub="Lekki sprawdzian zrozumienia. Materiał wchodzi w audyt po opanowaniu, a kolejne terminy dopasowują się do Twoich wyników. Jedna sesja to maksymalnie kilka pytań — bez presji, rób gdy masz czas."
      />

      <section className="mt-10">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted mb-3">
          Do sprawdzenia
          {due.length > 0 && (
            <span className="ml-2 text-accent normal-case tracking-normal font-sans">
              · {due.length}
            </span>
          )}
        </h2>
        {due.length === 0 ? (
          <div className="bg-surface border border-line rounded-xl p-6 text-center text-muted text-[13px]">
            Nic nie czeka na audyt. Materiały pojawią się tu po opanowaniu i odczekaniu kilku dni.
          </div>
        ) : (
          <div className="bg-surface border border-line rounded-xl p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="font-serif text-[17px]">
                  {due.length} {due.length === 1 ? "materiał gotowy" : "materiałów gotowych"} do sprawdzenia
                </div>
                <div className="text-muted text-[13px] mt-1">
                  Najbliższa sesja: {sessionSize} {sessionSize === 1 ? "materiał" : "materiały/materiałów"}
                  {" "}· do {AUDIT_QUESTIONS_PER_MATERIAL} pytań z każdego
                  {due.length > sessionSize && `, reszta (${due.length - sessionSize}) zostaje w kolejce`}.
                </div>
              </div>
              <Link
                href="/sessions/audit/run"
                className="shrink-0 bg-accent text-accent-fg px-5 py-2.5 rounded-lg text-[14px] font-medium hover:opacity-90 transition-opacity"
              >
                Zacznij audyt →
              </Link>
            </div>
            <ul className="mt-4 pt-4 border-t border-line space-y-1.5">
              {due.slice(0, sessionSize).map((a) => (
                <li key={a.id} className="flex items-center gap-3 text-[13px]">
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted bg-elevated px-2 py-0.5 rounded">
                    {roundLabel(a.audit_round)}
                  </span>
                  <span className="truncate text-subtle">{a.material_title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted mb-3">
          Nadchodzące
          {upcoming.length > 0 && (
            <span className="ml-2 normal-case tracking-normal font-sans">· {upcoming.length}</span>
          )}
        </h2>
        {upcoming.length === 0 ? (
          <div className="bg-surface border border-line rounded-xl p-6 text-center text-muted text-[13px]">
            Brak zaplanowanych audytów. Pojawią się po opanowaniu materiałów.
          </div>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((a) => {
              const inDays = daysBetween(a.scheduled_for);
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-4 bg-surface border border-line rounded-xl p-5"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="shrink-0 font-mono text-[11px] font-medium uppercase tracking-[0.15em] px-2.5 py-1 rounded bg-elevated text-muted">
                      {roundLabel(a.audit_round)}
                    </span>
                    <div className="min-w-0">
                      <div className="font-serif text-[16px] truncate">{getTitle(a)}</div>
                      <div className="text-muted text-[12px] font-mono mt-0.5">
                        {formatDatePl(a.scheduled_for)}
                      </div>
                    </div>
                  </div>
                  <span className="shrink-0 text-muted text-[12px] font-mono uppercase tracking-[0.15em]">
                    Za {inDays} {inDays === 1 ? "dzień" : "dni"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted mb-3">
          Ostatnio wykonane
          {completed.length > 0 && (
            <span className="ml-2 normal-case tracking-normal font-sans">· {completed.length}</span>
          )}
        </h2>
        {completed.length === 0 ? (
          <div className="bg-surface border border-line rounded-xl p-6 text-center text-muted text-[13px]">
            Brak wykonanych audytów.
          </div>
        ) : (
          <ul className="space-y-2">
            {completed.map((a) => {
              const score = a.performance_score != null ? Number(a.performance_score) : null;
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-4 bg-surface border border-line rounded-xl p-5 opacity-80"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.15em] text-muted px-2.5 py-1 rounded bg-elevated">
                      {roundLabel(a.audit_round)}
                    </span>
                    <div className="min-w-0">
                      <div className="font-serif text-[15px] truncate">{getTitle(a)}</div>
                      <div className="text-muted text-[12px] font-mono mt-0.5">
                        {a.completed_at ? formatDatePl(a.completed_at) : "—"}
                      </div>
                    </div>
                  </div>
                  {score != null && (
                    <span
                      className={cn(
                        "shrink-0 font-mono text-[12px] font-semibold uppercase tracking-[0.15em] px-2.5 py-1 rounded",
                        scoreTone(score),
                      )}
                    >
                      {Math.round(score * 100)}%
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
