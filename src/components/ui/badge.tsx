import * as React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "outline" | "accent" | "muted";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        variant === "default" && "bg-accent-muted text-accent",
        variant === "outline" && "border border-accent text-accent",
        variant === "accent" && "bg-accent text-white",
        variant === "muted" && "bg-card-hover text-muted",
        className
      )}
      {...props}
    />
  );
}
