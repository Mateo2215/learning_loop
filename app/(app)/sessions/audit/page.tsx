import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDueAudits, type DueAudit } from "@/lib/audits/scheduler";
import { SectionHeader } from "@/components/shared/section-header";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

interface UpcomingRow {
  id: string;
  material_id: string;
  trigger: string;
  scheduled_for: string;
  materials: { title: string } | { title: string }[] | null;
}

interface CompletedRow {
  id: string;
  material_id: string;
  trigger: string;
  scheduled_for: string;
  completed_at: string | null;
  performance_score: number | string | null;
  materials: { title: string } | { title: string }[] | null;
}

const TRIGGER_CODE: Record<string, string> = {
  day_7: "7D",
  day_30: "30D",
  day_90: "90D",
  resurrection: "RES",
};

const TRIGGER_DOT: Record<string, string> = {
  day_7: "bg-accent-2",
  day_30: "bg-accent",
  day_90: "bg-warn",
  resurrection: "bg-muted",
};

const TRIGGER_TEXT: Record<string, string> = {
  day_7: "text-accent-2",
  day_30: "text-accent",
  day_90: "text-warn",
  resurrection: "text-muted",
};

function getTitle(row: { materials: { title: string } | { title: string }[] | null }): string {
  const m = row.materials;
  if (!m) return "(materiał usunięty)";
  return Array.isArray(m) ? m[0]?.title ?? "(materiał usunięty)" : m.title;
}

function daysBetween(iso: string, now = Date.now()): number {
  const ms = new Date(iso).getTime() - now;
  return Math.round(Math.abs(ms) / (24 * 60 * 60 * 1000));
}

function formatDatePl(iso: string): string {
  return new Date(iso).toLocaleDateString("pl-PL", { day: "2-digit", month: "long" });
}

function scoreTone(score: number): { variant: "default" | "accent-2" | "danger"; cls: string } {
  if (score < 0.6) return { variant: "danger", cls: "" };
  if (score < 0.8) return { variant: "default", cls: "text-warn bg-warn/10" };
  return { variant: "accent-2", cls: "text-ok bg-ok/10" };
}

export default async function AuditsListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let due: DueAudit[];
  try {
    due = await getDueAudits(supabase, user.id);
  } catch {
    due = [];
  }

  const nowIso = new Date().toISOString();

  const [{ data: upcomingRows }, { data: completedRows }] = await Promise.all([
    supabase
      .from("topic_audits")
      .select("id, material_id, trigger, scheduled_for, materials!inner(title)")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .gt("scheduled_for", nowIso)
      .order("scheduled_for", { ascending: true })
      .limit(15),
    supabase
      .from("topic_audits")
      .select("id, material_id, trigger, scheduled_for, completed_at, performance_score, materials!inner(title)")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(10),
  ]);

  const upcoming = (upcomingRows ?? []) as UpcomingRow[];
  const completed = (completedRows ?? []) as CompletedRow[];

  return (
    <div className="max-w-[1024px] mx-auto px-6 py-10">
      <SectionHeader
        title="Audyty"
        sub="Zaplanowane sprawdziany wiedzy. AI generuje świeże pytania po 7, 30 i 90 dniach od importu materiału."
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Chip className="!normal-case !tracking-normal">
          <span className="w-2 h-2 rounded-full bg-accent-2 mr-1.5" />
          7 dni — krótki
        </Chip>
        <Chip className="!normal-case !tracking-normal">
          <span className="w-2 h-2 rounded-full bg-accent mr-1.5" />
          30 dni — średni
        </Chip>
        <Chip className="!normal-case !tracking-normal">
          <span className="w-2 h-2 rounded-full bg-warn mr-1.5" />
          90 dni — głęboki
        </Chip>
      </div>

      <section className="mt-10">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted mb-3">
          Zaległe
          {due.length > 0 && (
            <span className="ml-2 text-warn normal-case tracking-normal font-sans">
              · {due.length}
            </span>
          )}
        </h2>
        {due.length === 0 ? (
          <div className="bg-surface border border-line rounded-xl p-6 text-center text-muted text-[13px]">
            Brak zaległych audytów.
          </div>
        ) : (
          <ul className="space-y-2">
            {due.map((a) => {
              const overdueDays = daysBetween(a.scheduled_for);
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-4 bg-surface border border-warn/30 rounded-xl p-5"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="shrink-0 font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-warn bg-warn/10 px-2.5 py-1 rounded">
                      {overdueDays === 0 ? "DZIŚ" : `${overdueDays}D ZALEGLY`}
                    </span>
                    <div className="min-w-0">
                      <div className="font-serif text-[16px] truncate">{a.material_title}</div>
                      <div className="text-muted text-[12px] font-mono mt-0.5">
                        {TRIGGER_CODE[a.trigger] ?? "AUDYT"} · zaplanowany {formatDatePl(a.scheduled_for)}
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/sessions/audit/${a.id}`}
                    className="shrink-0 bg-accent text-accent-fg px-4 py-2 rounded-lg text-[13px] font-medium hover:opacity-90 transition-opacity"
                  >
                    Zacznij audyt →
                  </Link>
                </li>
              );
            })}
          </ul>
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
            Brak zaplanowanych audytów. Pojawią się gdy zaimportujesz nowe materiały.
          </div>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((a) => {
              const inDays = daysBetween(a.scheduled_for);
              const code = TRIGGER_CODE[a.trigger] ?? "AUDYT";
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-4 bg-surface border border-line rounded-xl p-5"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span
                      className={cn(
                        "shrink-0 font-mono text-[11px] font-medium uppercase tracking-[0.15em] px-2.5 py-1 rounded bg-elevated",
                        TRIGGER_TEXT[a.trigger] ?? "text-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle",
                          TRIGGER_DOT[a.trigger] ?? "bg-muted",
                        )}
                      />
                      {code}
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
              const tone = score != null ? scoreTone(score) : null;
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-4 bg-surface border border-line rounded-xl p-5 opacity-80"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.15em] text-muted px-2.5 py-1 rounded bg-elevated">
                      {TRIGGER_CODE[a.trigger] ?? "AUDYT"}
                    </span>
                    <div className="min-w-0">
                      <div className="font-serif text-[15px] truncate">{getTitle(a)}</div>
                      <div className="text-muted text-[12px] font-mono mt-0.5">
                        {a.completed_at ? formatDatePl(a.completed_at) : "—"}
                      </div>
                    </div>
                  </div>
                  {score != null && tone && (
                    <span
                      className={cn(
                        "shrink-0 font-mono text-[12px] font-semibold uppercase tracking-[0.15em] px-2.5 py-1 rounded",
                        tone.cls || "bg-elevated text-fg",
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
