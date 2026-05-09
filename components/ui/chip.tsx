import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ChipVariant = "default" | "accent" | "accent-2" | "danger";
export type ChipSize = "sm" | "md";

export interface ChipProps {
  children: ReactNode;
  variant?: ChipVariant;
  size?: ChipSize;
  className?: string;
}

const VARIANT_CLASSES: Record<ChipVariant, string> = {
  default: "bg-elevated text-subtle border-line",
  accent: "bg-accent-soft text-accent border-transparent",
  "accent-2": "bg-accent-2-soft text-accent-2 border-transparent",
  danger: "bg-bad/10 text-bad border-transparent",
};

const SIZE_CLASSES: Record<ChipSize, string> = {
  sm: "h-5 px-2 text-[10px]",
  md: "h-6 px-2.5 text-[11px]",
};

export function Chip({
  children,
  variant = "default",
  size = "md",
  className,
}: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border font-mono uppercase tracking-[0.15em] whitespace-nowrap",
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
