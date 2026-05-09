import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SectionHeaderProps {
  title: ReactNode;
  sub?: ReactNode;
  /** Alias for `sub` — keeps backwards-compat with the old PageHeader API. */
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  sub,
  description,
  actions,
  className,
}: SectionHeaderProps) {
  const subtitle = sub ?? description;
  return (
    <div
      className={cn(
        "mb-8 flex items-start justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-serif text-[36px] font-medium leading-tight tracking-[-0.015em] text-fg">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 max-w-prose text-[14px] text-muted">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

// Backwards-compat alias — many pages still import PageHeader.
export const PageHeader = SectionHeader;
export type PageHeaderProps = SectionHeaderProps;
