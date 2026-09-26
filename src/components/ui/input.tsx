import type * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-line bg-card px-4 text-sm text-ink placeholder:text-ink-3 transition-colors focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember/30 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
