import * as React from "react"
import clsx from "clsx"

export function Separator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("h-px w-full bg-[var(--color-surface)]", className)} {...props} />
  )
}
