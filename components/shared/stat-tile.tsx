import Link from "next/link";
import { cn } from "@/lib/utils";

export interface StatTileProps {
  value: string | number;
  label: string;
  emphasize?: boolean;
  mono?: boolean;
  href?: string;
  sub?: string;
}

export function StatTile({ value, label, emphasize = false, mono = false, href, sub }: StatTileProps) {
  const inner = (
    <>
      <div className={cn("text-3xl font-medium leading-none", mono ? "font-mono" : "font-serif")}>
        {value}
      </div>
      <div className="mt-2 text-sm text-muted">{label}</div>
      {sub && <div className="mt-1 text-xs text-muted/80">{sub}</div>}
    </>
  );

  const className = cn(
    "group block rounded-xl border bg-surface p-5 transition-all duration-200",
    "shadow-sm shadow-black/[0.02] dark:shadow-black/20",
    emphasize ? "border-accent/60 bg-accent-soft/40" : "border-line",
    href &&
      "hover:border-line-strong hover:bg-elevated hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}
