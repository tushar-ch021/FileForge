import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-blue-50 text-blue-700 border border-blue-200/60",
        secondary:
          "border-transparent bg-slate-100 text-slate-700",
        outline:
          "text-slate-700 border border-slate-200 bg-white",
        success:
          "bg-emerald-50 text-emerald-700 border border-emerald-200/60",
        destructive:
          "bg-rose-50 text-rose-700 border border-rose-200/80 font-medium",
        clientSide:
          "bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-medium flex items-center gap-1",
        popular:
          "bg-blue-600 text-white shadow-xs font-medium",
        essential:
          "bg-slate-900 text-white font-medium",
        new:
          "bg-amber-50 text-amber-800 border border-amber-200/80 font-medium",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
