"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { TopNav } from "@/components/shared/top-nav";
import { BottomNav } from "@/components/shared/bottom-nav";
import { OnlineIndicator } from "@/components/shared/online-indicator";

export interface AppChromeProps {
  email: string | null;
  signOutAction: () => Promise<void>;
  /** Server-rendered slot inserted between TopNav and the page content. */
  banner?: ReactNode;
}

// Focus mode (review run + deep-dive run) hides the global nav chrome.
// Picker pages like `/sessions/deep-dive` (no slash after) keep the chrome.
function isFocusMode(pathname: string): boolean {
  if (pathname === "/sessions/review") return true;
  if (pathname.startsWith("/sessions/deep-dive/")) return true;
  if (/^\/sessions\/audit\/[^/]+$/.test(pathname)) return true;
  return false;
}

export function AppChrome({ email, signOutAction, banner }: AppChromeProps) {
  const pathname = usePathname() ?? "";
  if (isFocusMode(pathname)) return null;

  return (
    <>
      <TopNav email={email} signOutAction={signOutAction} />
      {banner}
      <BottomNav />
      <OnlineIndicator />
    </>
  );
}
