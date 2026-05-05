import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/shared/top-nav";
import { BottomNav } from "@/components/shared/bottom-nav";
import { OnlineIndicator } from "@/components/shared/online-indicator";
import { CostLimitBanner } from "@/components/shared/cost-limit-banner";

/**
 * Shared layout for all authenticated routes. TopNav handles desktop nav +
 * mobile hamburger; BottomNav adds 4-item icon bar on mobile (poza sesjami).
 * Both components hide themselves on session-run paths via `isSessionRunPath`.
 *
 * Auth check is also done in middleware (proxy.ts), but we re-check here to
 * fail closed if the cookie is somehow stale.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <TopNav email={user.email ?? null} signOutAction={signOut} />
      <CostLimitBanner />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <BottomNav />
      <OnlineIndicator />
    </div>
  );
}
