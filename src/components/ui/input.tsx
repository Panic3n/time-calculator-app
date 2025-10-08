import * as React from "react"
import clsx from "clsx"

type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={clsx(
        "flex h-9 w-full rounded-md border bg-[var(--color-bg)] text-[var(--color-text)] px-3 py-1 text-sm shadow-sm",
        "border-[var(--color-surface)] placeholder:text-[var(--color-text)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
})
Input.displayName = "Input"
