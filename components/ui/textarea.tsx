import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-fg shadow-xs transition-[color,box-shadow,border-color] outline-none placeholder:text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-bad aria-invalid:ring-bad/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
