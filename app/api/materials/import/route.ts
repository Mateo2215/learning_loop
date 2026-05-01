import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseFile, parsePastedText } from "@/lib/processing/parse";
import { processMaterial } from "@/lib/processing/pipeline";
import { CATEGORIES } from "@/lib/db/types";
import type { ImportJobPayload } from "@/lib/db/types";

const FormSchema = z.object({
  title: z.string().min(3).max(200),
  category: z.enum(CATEGORIES),
});

/**
 * POST /api/materials/import
 *
 * Accepts multipart/form-data with fields:
 *   - title (string)
 *   - category (Category)
 *   - file (File, optional) — DOCX/MD/TXT
 *   - pasted_text (string, optional) — used when no file
 *
 * Creates a `processing_jobs` row, kicks off the pipeline async (fire-and-forget
 * within the route — Next.js dev server keeps the function alive long enough),
 * and returns `{ job_id }` immediately. Client polls or subscribes to the job
 * row for progress.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid form data" }, { status: 400 });
  }

  const formCheck = FormSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
  });
  if (!formCheck.success) {
    return NextResponse.json(
      { error: "validation failed", issues: formCheck.error.issues },
      { status: 400 }
    );
  }
  const { title, category } = formCheck.data;

  const file = formData.get("file");
  const pastedText = formData.get("pasted_text");

  let parsed;
  try {
    if (file instanceof File && file.size > 0) {
      parsed = await parseFile(file);
    } else if (typeof pastedText === "string" && pastedText.trim().length > 0) {
      parsed = parsePastedText(pastedText);
    } else {
      return NextResponse.json(
        { error: "podaj plik lub wklej tekst" },
        { status: 400 }
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "parse failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const payload: ImportJobPayload = {
    title,
    category,
    source_type: parsed.sourceType,
    source_filename: parsed.filename,
    raw_text: parsed.text,
  };

  const { data: job, error: jobErr } = await supabase
    .from("processing_jobs")
    .insert({
      user_id: user.id,
      job_type: "import",
      status: "pending",
      progress: 0,
      payload,
    })
    .select("id")
    .single();

  if (jobErr || !job) {
    return NextResponse.json(
      { error: `failed to create job: ${jobErr?.message ?? "unknown"}` },
      { status: 500 }
    );
  }

  // Fire-and-forget. We don't `await` because we want to return the job ID
  // to the client immediately. Errors inside processMaterial mark the job as
  // failed and are caught there — they never bubble up here.
  void processMaterial({
    supabase,
    userId: user.id,
    jobId: job.id,
    payload,
  }).catch((err) => {
    console.error("[import] pipeline crashed:", err);
  });

  return NextResponse.json({ job_id: job.id });
}
