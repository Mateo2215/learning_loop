import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const RATING_MAP: Record<number, { rating: string; label: string }> = {
  1: { rating: "again", label: "Znów" },
  2: { rating: "hard", label: "Trudne" },
  3: { rating: "good", label: "Dobrze" },
  4: { rating: "easy", label: "Łatwe" },
};

const EVAL_MAP: Record<string, { rating: string; label: string }> = {
  correct: { rating: "easy", label: "Poprawna" },
  partially_correct: { rating: "hard", label: "Częściowo" },
  incorrect: { rating: "again", label: "Błędna" },
};

/**
 * GET /api/items/:id/history
 *
 * Returns the last 5 reviews for the given item. Used by the session side panel
 * to show "Historia karty".
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: itemId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("reviews")
    .select("created_at, fsrs_rating, ai_evaluation")
    .eq("item_id", itemId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const history = (data ?? []).map((r) => {
    const row = r as { created_at: string; fsrs_rating: number | null; ai_evaluation: string | null };
    const mapped =
      row.fsrs_rating != null
        ? RATING_MAP[row.fsrs_rating]
        : row.ai_evaluation
          ? EVAL_MAP[row.ai_evaluation]
          : { rating: "new", label: "Nowa" };

    return {
      date: new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "short" }).format(
        new Date(row.created_at)
      ),
      rating: mapped?.rating ?? "new",
      label: mapped?.label ?? "—",
    };
  });

  return NextResponse.json({ history });
}
