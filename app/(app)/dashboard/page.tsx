import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ count: materialsCount }, { count: itemsCount }] = await Promise.all([
    supabase.from("materials").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("items").select("id", { count: "exact", head: true }),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{materialsCount ?? 0}</CardTitle>
            <CardDescription>materiałów</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{itemsCount ?? 0}</CardTitle>
            <CardDescription>wygenerowanych pytań i fiszek</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/sessions/review">Zacznij Review →</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/materials/import">+ Nowy materiał</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/materials">Wszystkie materiały</Link>
        </Button>
      </div>
    </div>
  );
}
