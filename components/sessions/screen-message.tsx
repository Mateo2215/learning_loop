import type { ReactNode } from "react";

export interface ScreenMessageProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * Centered single-message screen used in session loading / empty / done /
 * error phases. Lives outside SessionShell because some uses (loading) render
 * before any session data is available.
 */
export function ScreenMessage({ title, description, action }: ScreenMessageProps) {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center flex flex-col items-center gap-3">
        <h2 className="font-serif text-2xl font-medium leading-tight">{title}</h2>
        {description && <p className="text-sm text-muted">{description}</p>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
