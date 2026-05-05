import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  cta?: ReactNode;
}

export function EmptyState({ icon, title, description, cta }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-line bg-surface px-6 py-12 flex flex-col items-center text-center">
      {icon && <div className="mb-4 text-muted">{icon}</div>}
      <h2 className="font-serif text-xl font-medium">{title}</h2>
      {description && (
        <p className="mt-2 text-sm text-muted max-w-prose">{description}</p>
      )}
      {cta && <div className="mt-6">{cta}</div>}
    </div>
  );
}
