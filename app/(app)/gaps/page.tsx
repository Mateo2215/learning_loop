import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GapsClient } from "./gaps-client";
import type { KnowledgeGap } from "@/lib/db/types";
import { PageHeader } from "@/components/shared/page-header";

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
      <PageHeader
        title={
          <>
            Luki wiedzy
            <span className="text-muted font-mono text-base ml-3 align-middle">
              · {gaps?.length ?? 0}
            </span>
          </>
        }
        description="AI analizuje Twoje powtórki i wskazuje obszary, które wymagają uzupełnienia."
      />
      <GapsClient initialGaps={(gaps ?? []) as KnowledgeGap[]} />
    </div>
  );
}
