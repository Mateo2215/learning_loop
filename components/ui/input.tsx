import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-line bg-surface px-3 py-1 text-base text-fg shadow-xs transition-[color,box-shadow,border-color] outline-none selection:bg-accent selection:text-accent-fg file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-fg placeholder:text-muted disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30",
        "aria-invalid:border-bad aria-invalid:ring-bad/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
