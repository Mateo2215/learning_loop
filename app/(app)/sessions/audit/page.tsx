import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDueAudits, type DueAudit } from "@/lib/audits/scheduler";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

const TRIGGER_BADGE: Record<string, { code: string; tone: "warn" | "accent" | "bad" | "muted" }> = {
  day_7: { code: "7D", tone: "warn" },
  day_30: { code: "30D", tone: "accent" },
  day_90: { code: "90D", tone: "bad" },
  resurrection: { code: "RES", tone: "muted" },
};

const TRIGGER_LABEL: Record<string, string> = {
  day_7: "Po 7 dniach",
  day_30: "Po 30 dniach",
  day_90: "Po 90 dniach",
  resurrection: "Powrót do zaniedbanego tematu",
};

function formatRelative(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const day = 24 * 60 * 60 * 1000;
  if (abs < day) return ms < 0 ? "dzisiaj (zaległy)" : "dzisiaj";
  const days = Math.round(abs / day);
  return ms < 0 ? `${days}d zaległy` : `za ${days}d`;
}

export default async function AuditsListPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let due: DueAudit[];
  try {
    due = await getDueAudits(supabase, user.id);
  } catch {
    due = [];
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <PageHeader
        title={
          <>
            Audyty
            <span className="text-muted font-mono text-base ml-3 align-middle">
              · {due.length}
            </span>
          </>
        }
        description="Sprawdzenie utrwalenia po 7, 30 i 90 dniach. AI generuje świeże pytania."
      />

      {due.length === 0 ? (
        <EmptyState
          title="Brak audytów na dziś"
          description="Audyty pojawiają się automatycznie 7, 30 i 90 dni po imporcie materiału."
          cta={
            <Button variant="outline" asChild>
              <Link href="/dashboard">← Dashboard</Link>
            </Button>
          }
        />
      ) : (
        <ul className="border-y border-line divide-y divide-line">
          {due.map((a) => {
            const badge = TRIGGER_BADGE[a.trigger] ?? TRIGGER_BADGE.resurrection;
            const toneClass = {
              warn: "bg-warn/15 text-warn",
              accent: "bg-accent/15 text-accent",
              bad: "bg-bad/15 text-bad",
              muted: "bg-elevated text-muted",
            }[badge.tone];
            return (
              <li
                key={a.id}
                className="flex items-center gap-3 py-3"
                title={TRIGGER_LABEL[a.trigger] ?? a.trigger}
              >
                <span
                  className={`font-mono text-xs font-semibold px-2 py-1 rounded ${toneClass} shrink-0`}
                >
                  {badge.code}
                </span>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/sessions/audit/${a.id}`}
                    className="font-serif text-base font-medium hover:underline truncate block"
                  >
                    {a.material_title}
                  </Link>
                  <div className="text-xs text-muted font-mono mt-0.5">
                    {formatRelative(a.scheduled_for)}
                  </div>
                </div>
                <Button size="sm" asChild>
                  <Link href={`/sessions/audit/${a.id}`}>Zacznij →</Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
