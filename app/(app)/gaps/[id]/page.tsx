import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GapDetailClient } from "./detail-client";
import type { KnowledgeGap } from "@/lib/db/types";

export default async function GapDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: gap } = await supabase
    .from("knowledge_gaps")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!gap) notFound();

  let materialTitles: string[] = [];
  const g = gap as KnowledgeGap;
  if (g.affected_materials.length > 0) {
    const { data: mats } = await supabase
      .from("materials")
      .select("title")
      .in("id", g.affected_materials);
    materialTitles = ((mats ?? []) as { title: string }[]).map((m) => m.title);
  }

  return <GapDetailClient gap={g} materialTitles={materialTitles} />;
}
