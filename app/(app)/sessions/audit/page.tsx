import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDueAudits, type DueAudit } from "@/lib/audits/scheduler";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const TRIGGER_LABEL: Record<string, string> = {
  day_7: "Po 7 dniach",
  day_30: "Po 30 dniach",
  day_90: "Po 90 dniach",
  resurrection: "Powrót do zaniedbanego tematu",
};

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
      <h1 className="text-2xl font-semibold mb-2">Audyty</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
        Sprawdzenie utrwalenia po 7 / 30 / 90 dniach. AI generuje świeże pytania.
      </p>

      {due.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brak audytów na dziś</CardTitle>
            <CardDescription>
              Audyty pojawiają się automatycznie 7, 30 i 90 dni po imporcie materiału.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href="/dashboard">← Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {due.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <CardTitle className="text-base">{a.material_title}</CardTitle>
                <CardDescription>
                  {TRIGGER_LABEL[a.trigger] ?? a.trigger} · zaplanowano{" "}
                  {new Date(a.scheduled_for).toLocaleString("pl-PL")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href={`/sessions/audit/${a.id}`}>Zacznij audyt →</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
