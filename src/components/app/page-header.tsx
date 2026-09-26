export function PageHeader({ eyebrow, titulo, children }: { eyebrow: string; titulo: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
      <div>
        <p className="num text-[11px] uppercase tracking-[0.2em] text-ember">{eyebrow}</p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight md:text-5xl">{titulo}</h1>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}

export function Vacio({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <div className="rise mt-10 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <p className="font-serif text-2xl">{titulo}</p>
      {children && <div className="mx-auto mt-3 max-w-md text-sm text-ink-2">{children}</div>}
    </div>
  );
}
