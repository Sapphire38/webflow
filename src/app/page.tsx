import { ArrowRight, Database, LayoutDashboard, MessageSquareText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

const MESES = [
  ["ene", 42],
  ["feb", 55],
  ["mar", 48],
  ["abr", 61],
  ["may", 58],
  ["jun", 73],
  ["jul", 69],
  ["ago", 88],
] as const;

const PASOS = [
  { icon: Database, titulo: "Subí un CSV", texto: "O usá el dataset de ejemplo. Detectamos fechas, números y categorías solos." },
  { icon: MessageSquareText, titulo: "Preguntá", texto: "“¿Qué planta gasta más en correctivos?” El modelo arma la consulta; el motor hace las cuentas." },
  { icon: LayoutDashboard, titulo: "Guardá y narrá", texto: "Fijá el gráfico en un dashboard vivo y pedile a la IA un reporte ejecutivo." },
];

export default function Landing() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-8">
        <Logo />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Crear cuenta</Link>
          </Button>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-20 md:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
        <div className="rise">
          <p className="num inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-ink-2">
            <span className="size-1.5 rounded-full bg-ember" /> Analista conversacional
          </p>
          <h1 className="mt-6 font-serif text-6xl leading-[0.92] tracking-tight md:text-8xl">
            Tus datos,
            <br />
            <em className="text-ember">en una conversación.</em>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-2">
            Preguntá como le preguntarías a tu analista favorito. Insight consulta, calcula y grafica. Y cada número se puede
            rastrear hasta su receta.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="ember">
              <Link href="/signup">
                Probalo gratis <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Ya tengo cuenta</Link>
            </Button>
          </div>
        </div>

        <div className="rise relative" style={{ animationDelay: "150ms" }}>
          <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-ember-soft/60 blur-2xl" aria-hidden />
          <div className="rounded-3xl border border-line bg-card p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.35)]">
            <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-sm text-paper">
              ¿Cómo vienen los costos de mantenimiento este año?
            </div>
            <p className="mt-4 text-sm text-ink-2">
              Subieron <strong className="text-ink">+110%</strong> entre enero y agosto. Agosto fue el pico, empujado por correctivos
              en Córdoba. ¿Lo abro por planta?
            </p>
            <div className="mt-4 rounded-2xl border border-line p-4">
              <p className="font-serif text-xl">Costo mensual (M$)</p>
              <div className="mt-4 flex h-40 gap-2" role="img" aria-label="Gráfico de ejemplo: costo mensual creciente de enero a agosto">
                {MESES.map(([m, v], i) => (
                  <div key={m} className="flex h-full flex-1 flex-col items-center gap-2">
                    <div className="flex w-full flex-1 items-end">
                    <div
                      className="rise w-full rounded-t-md"
                      style={{
                        height: `${v}%`,
                        animationDelay: `${300 + i * 70}ms`,
                        background: i === MESES.length - 1 ? "var(--ember)" : "color-mix(in srgb, var(--ember) 45%, var(--paper))",
                      }}
                    />
                    </div>
                    <span className="num text-[10px] text-ink-3">{m}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="num mt-3 flex items-center gap-2 text-[11px] text-ink-3">
              <span className="size-1.5 rounded-full bg-ok" /> agregar_dataset · sumar(costo) por mes · 480 filas
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-paper-2/60">
        <ol className="mx-auto grid max-w-6xl gap-px px-4 md:grid-cols-3 md:px-8">
          {PASOS.map(({ icon: Icon, titulo, texto }, i) => (
            <li key={titulo} className="py-10 md:px-6 md:first:pl-0">
              <p className="num text-xs text-ember">0{i + 1}</p>
              <Icon className="mt-4 size-6" />
              <p className="mt-3 font-serif text-3xl">{titulo}</p>
              <p className="mt-2 text-sm text-ink-2">{texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-20 md:grid-cols-2 md:px-8">
        <div>
          <h2 className="font-serif text-5xl leading-none tracking-tight">
            El modelo pregunta.
            <br />
            <em className="text-ember">El motor responde.</em>
          </h2>
        </div>
        <ul className="space-y-5 text-ink-2">
          <li className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ember" />
            <span>
              <strong className="text-ink">Sin números inventados.</strong> El LLM (MiniMax) solo arma la consulta; las sumas, promedios y
              agrupaciones las calcula un motor determinístico y testeado.
            </span>
          </li>
          <li className="flex gap-3">
            <LayoutDashboard className="mt-0.5 size-5 shrink-0 text-ember" />
            <span>
              <strong className="text-ink">Dashboards que no envejecen.</strong> Cada widget guarda su receta y se recalcula al abrirlo.
            </span>
          </li>
          <li className="flex gap-3">
            <Database className="mt-0.5 size-5 shrink-0 text-ember" />
            <span>
              <strong className="text-ink">Tus datos son tuyos.</strong> Supabase Auth + Row Level Security en Postgres: nadie más ve tus
              filas, ni siquiera por API.
            </span>
          </li>
        </ul>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-line px-4 py-8 text-xs text-ink-3 md:px-8">
        <Logo className="text-ink" />
        <span className="num">Next.js · Supabase · MiniMax · Webflow Cloud — Nerdearla 2026</span>
      </footer>
    </div>
  );
}
