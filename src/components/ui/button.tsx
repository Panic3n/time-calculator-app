import * as React from "react"
import clsx from "clsx"

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary"
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const base = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none h-9 px-4 py-2 focus:ring-[var(--color-primary)] focus:ring-offset-[var(--color-bg)]"
    const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
      default: "bg-[var(--color-primary)] text-[var(--color-bg)] hover:brightness-95",
      outline: "border border-[var(--color-surface)] bg-[var(--color-bg)] text-[var(--color-text)] hover:bg-[var(--color-surface)]/60",
      ghost: "text-[var(--color-text)] hover:bg-[var(--color-surface)]/60",
      destructive: "bg-red-600 text-white hover:bg-red-700",
      secondary: "bg-[var(--color-surface)] text-[var(--color-text)] hover:brightness-110",
    }
    return (
      <button ref={ref} className={clsx(base, variants[variant], className)} {...props} />
    )
  }
)
Button.displayName = "Button"
