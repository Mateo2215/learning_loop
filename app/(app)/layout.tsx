import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppChrome } from "@/components/shared/app-chrome";
import { CostLimitBanner } from "@/components/shared/cost-limit-banner";

/**
 * Shared layout for all authenticated routes. Auth check is also done in
 * middleware (proxy.ts), but we re-check here to fail closed if the cookie
 * is somehow stale.
 *
 * Nav chrome (TopNav + cost banner + BottomNav + online indicator) lives in
 * <AppChrome>, which reads the pathname and hides itself on focus-mode
 * routes (review run, deep-dive run, audit run). This lets nested route
 * segments inherit a clean, full-bleed canvas without re-declaring layouts.
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
      <AppChrome
        email={user.email ?? null}
        signOutAction={signOut}
        banner={<CostLimitBanner />}
      />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
    </div>
  );
}
