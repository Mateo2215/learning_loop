/**
 * Single source of truth for the four "session" entry points (Fiszki, Deep Dive,
 * Audyty, Luki wiedzy). Shared by the desktop dropdown (top-nav), the mobile
 * hamburger drawer (mobile-nav) and the bottom-sheet picker so labels, hrefs and
 * ordering never drift apart.
 */

import { Repeat, Microscope, ClipboardCheck, Lightbulb, type LucideIcon } from "lucide-react";

/** Key into the counts payload from /api/sessions/counts, if the item shows one. */
export type SessionCountKey = "reviewsDue" | "deepDiveAvailable" | "auditsDue" | "gapsOpen";

export interface SessionNavItem {
  href: string;
  label: string;
  description: string;
  Icon: LucideIcon;
  /** Which counter to display next to the item (undefined = no count shown). */
  countKey?: SessionCountKey;
  /** Whether a non-zero count is an attention signal (warn color) vs neutral. */
  alert?: boolean;
}

export const SESSION_NAV_ITEMS: SessionNavItem[] = [
  {
    href: "/sessions/review",
    label: "Fiszki",
    description: "Powtórki spaced repetition",
    Icon: Repeat,
    countKey: "reviewsDue",
  },
  {
    href: "/sessions/deep-dive",
    label: "Deep Dive",
    description: "Pytania otwarte z walidacją AI",
    Icon: Microscope,
    countKey: "deepDiveAvailable",
  },
  {
    href: "/sessions/audit",
    label: "Audyty",
    description: "Lekkie sprawdzenie zrozumienia — bez presji",
    Icon: ClipboardCheck,
    countKey: "auditsDue",
  },
  {
    href: "/gaps",
    label: "Luki wiedzy",
    description: "Co warto douczyć z Claude.ai",
    Icon: Lightbulb,
    countKey: "gapsOpen",
    alert: true,
  },
];
