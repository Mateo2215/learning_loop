"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { ComponentProps, ReactNode } from "react";

type ButtonVariant = ComponentProps<typeof Button>["variant"];
type ButtonSize = ComponentProps<typeof Button>["size"];

export interface ConfirmButtonProps {
  onConfirm: () => void | Promise<void>;
  children: ReactNode;
  confirmLabel?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
}

const RESET_MS = 4000;

export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "Na pewno?",
  variant = "outline",
  size,
  disabled,
  className,
}: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  function handleClick() {
    if (!armed) {
      setArmed(true);
      timerRef.current = window.setTimeout(() => setArmed(false), RESET_MS);
      return;
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setArmed(false);
    void onConfirm();
  }

  return (
    <Button
      type="button"
      variant={armed ? "destructive" : variant}
      size={size}
      disabled={disabled}
      onClick={handleClick}
      className={className}
    >
      {armed ? confirmLabel : children}
    </Button>
  );
}
