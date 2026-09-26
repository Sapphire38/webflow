import { cn } from "@/lib/utils";

/** Marca: una llama geométrica que también es un gráfico de barras ascendente. */
export function Logo({ className, conTexto = true }: { className?: string; conTexto?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" aria-hidden className="size-7">
        <rect x="4" y="18" width="5" height="10" rx="1.5" fill="currentColor" opacity="0.35" />
        <rect x="11.5" y="12" width="5" height="16" rx="1.5" fill="currentColor" opacity="0.6" />
        <path d="M19 28V10c0-3 2-5.5 4.5-7 .6 2.4 4.5 5 4.5 10v15a0 0 0 0 1 0 0h-9Z" fill="var(--ember)" />
      </svg>
      {conTexto && (
        <span className="font-serif text-[1.35rem] leading-none tracking-tight">
          Insight<span className="text-ember">.</span>
        </span>
      )}
    </span>
  );
}
