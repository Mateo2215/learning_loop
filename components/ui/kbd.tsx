import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface KbdProps {
  children: ReactNode;
  className?: string;
}

export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center rounded-md border border-line bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-subtle",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
