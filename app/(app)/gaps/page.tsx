import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GapsClient } from "./gaps-client";
import type { KnowledgeGap } from "@/lib/db/types";

export default async function GapsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: gaps } = await supabase
    .from("knowledge_gaps")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "open")
    .order("severity", { ascending: false })
    .order("detected_at", { ascending: false });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-2">Luki wiedzy</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
        AI analizuje Twoje powtórki i wskazuje obszary, które wymagają uzupełnienia.
      </p>
      <GapsClient initialGaps={(gaps ?? []) as KnowledgeGap[]} />
    </div>
  );
}
