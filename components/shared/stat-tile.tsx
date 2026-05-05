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
    "block rounded-lg border bg-surface p-4 transition-colors",
    emphasize ? "border-accent/60" : "border-line",
    href && "hover:border-accent/60 cursor-pointer"
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
