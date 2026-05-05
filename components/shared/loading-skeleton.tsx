import { cn } from "@/lib/utils";

function Bar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-elevated", className)} />;
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-lg border border-line bg-surface p-4">
          <Bar className="h-4 w-2/3" />
          <Bar className="mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Bar className="h-8 w-1/2" />
      <Bar className="h-4 w-3/4" />
      <Bar className="h-4 w-2/3" />
      <Bar className="h-32 w-full mt-6" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Bar className="h-9 w-40" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-line bg-surface p-4">
            <Bar className="h-7 w-12" />
            <Bar className="mt-3 h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
