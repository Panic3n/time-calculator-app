import * as React from "react"
import clsx from "clsx"

type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => (
  <label ref={ref} className={clsx("text-sm font-medium text-slate-700", className)} {...props} />
))
Label.displayName = "Label"
