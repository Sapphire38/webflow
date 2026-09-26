"use client";
import * as LabelPrimitive from "@radix-ui/react-label";
import type * as React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn("text-xs font-medium uppercase tracking-[0.08em] text-ink-2", className)}
      {...props}
    />
  );
}
