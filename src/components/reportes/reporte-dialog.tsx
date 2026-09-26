"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Eye, FileText, Loader2, Palette, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { guardarBorradorReporte, guardarEstiloReporte, previsualizarReporte } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ChartSpec } from "@/lib/data/chart";
import type { Estilo, Tono } from "@/lib/data/estilo";
import { cn } from "@/lib/utils";
import { ReporteVista } from "./reporte-vista";

const PALETA = ["#e8501c", "#1f4e79", "#2f7a4b", "#7b3f8c", "#c9a227", "#16140f"];
const TONOS: { v: Tono; label: string; ayuda: string }[] = [
  { v: "ejecutivo", label: "Ejecutivo", ayuda: "Directo, para decidir" },
  { v: "cercano", label: "Cercano", ayuda: "Sin jerga, para equipos" },
  { v: "tecnico", label: "Técnico", ayuda: "Con detalle de métricas" },
];

interface Borrador {
  titulo: string;
  contenido: string;
  datos: ChartSpec[];
  estilo: Estilo;
}

export function ReporteDialog({ dashboardId, estiloInicial, deshabilitado }: { dashboardId: string; estiloInicial: Estilo; deshabilitado: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [estilo, setEstilo] = useState<Estilo>(estiloInicial);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [redactando, empezarRedaccion] = useTransition();
  const [guardando, empezarGuardado] = useTransition();
  const set = <K extends keyof Estilo>(k: K, v: Estilo[K]) => setEstilo((e) => ({ ...e, [k]: v }));
  // El borrador se ve con el estilo actual: los cambios de marca se aplican al instante sin volver a llamar a la IA.
  const vistaEstilo = { ...estilo };
  const vozCambio = borrador && (borrador.estilo.tono !== estilo.tono || borrador.estilo.instrucciones !== estilo.instrucciones);

  const previsualizar = () =>
    empezarRedaccion(async () => {
      const r = await previsualizarReporte(dashboardId, estilo);
      if (!r.ok) return void toast.error(r.error);
      setBorrador(r.data as Borrador);
    });

  const guardarEstilo = () =>
    empezarGuardado(async () => {
      const r = await guardarEstiloReporte(dashboardId, estilo);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Estilo guardado: se usa en los próximos reportes y envíos programados.");
      router.refresh();
    });

  const guardarReporte = () =>
    empezarGuardado(async () => {
      if (!borrador) return;
      const [e, r] = await Promise.all([guardarEstiloReporte(dashboardId, estilo), guardarBorradorReporte(dashboardId, { ...borrador, estilo })]);
      if (!e.ok) toast.error(e.error);
      if (!r.ok) return void toast.error(r.error);
      setAbierto(false);
      router.push(`/reportes/${r.data?.id}`);
    });

  const chip = (activo: boolean) => cn("rounded-full border px-3 py-1.5 text-sm", activo ? "border-ink bg-ink text-paper" : "border-line hover:border-ink");

  return (
    <Dialog.Root open={abierto} onOpenChange={setAbierto}>
      <Dialog.Trigger asChild>
        <Button variant="ember" disabled={deshabilitado}>
          <FileText /> Reporte con IA
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-2 z-50 mx-auto flex max-w-6xl flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-2xl sm:inset-6">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-7">
            <div>
              <Dialog.Title className="font-serif text-3xl">Reporte con estilo propio</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-ink-2">
                Elegí la marca y la voz, mirá la vista previa y guardalo. El estilo queda en este dashboard y se usa también en los envíos programados.
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-full p-2 text-ink-2 hover:bg-paper-2" aria-label="Cerrar">
              <X className="size-4" />
            </Dialog.Close>
          </header>
          <div className="grid min-h-0 flex-1 md:grid-cols-[20rem_1fr]">
            <aside className="space-y-6 overflow-y-auto border-b border-line p-5 md:border-r md:border-b-0 sm:p-6">
              <p className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-ink-3">
                <Palette className="size-3.5" /> Marca
              </p>
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium uppercase tracking-[0.08em] text-ink-2">Color de acento</legend>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {PALETA.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Acento ${c}`}
                      aria-pressed={estilo.acento === c}
                      onClick={() => set("acento", c)}
                      className={cn("size-8 rounded-full border-2 transition-transform hover:scale-110", estilo.acento === c ? "border-ink" : "border-transparent")}
                      style={{ background: c }}
                    />
                  ))}
                  <label className="relative size-8 cursor-pointer overflow-hidden rounded-full border border-line" title="Color propio">
                    <input type="color" value={estilo.acento} onChange={(e) => set("acento", e.target.value)} className="absolute -inset-2 size-12 cursor-pointer" aria-label="Color propio" />
                  </label>
                  <span className="num text-xs text-ink-3">{estilo.acento}</span>
                </div>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium uppercase tracking-[0.08em] text-ink-2">Tipografía de títulos</legend>
                <div className="flex gap-2 pt-1">
                  <button type="button" aria-pressed={estilo.tipografia === "serif"} onClick={() => set("tipografia", "serif")} className={cn(chip(estilo.tipografia === "serif"), "font-serif")}>
                    Editorial
                  </button>
                  <button type="button" aria-pressed={estilo.tipografia === "sans"} onClick={() => set("tipografia", "sans")} className={cn(chip(estilo.tipografia === "sans"), "font-semibold")}>
                    Moderna
                  </button>
                </div>
              </fieldset>
              <div className="space-y-2">
                <Label htmlFor="pie">Pie de página</Label>
                <Input id="pie" value={estilo.pie} maxLength={160} placeholder="Acme S.A. · Uso interno" onChange={(e) => set("pie", e.target.value)} />
              </div>

              <p className="flex items-center gap-2 pt-2 text-xs uppercase tracking-[0.14em] text-ink-3">
                <FileText className="size-3.5" /> Voz de la IA
              </p>
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium uppercase tracking-[0.08em] text-ink-2">Tono</legend>
                <div className="grid gap-2 pt-1">
                  {TONOS.map((t) => (
                    <button key={t.v} type="button" aria-pressed={estilo.tono === t.v} onClick={() => set("tono", t.v)} className={cn("rounded-xl border px-3 py-2 text-left", estilo.tono === t.v ? "border-ink bg-card" : "border-line hover:border-ink")}>
                      <span className="block text-sm font-medium">{t.label}</span>
                      <span className="block text-xs text-ink-3">{t.ayuda}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="space-y-2">
                <Label htmlFor="instrucciones">Instrucciones para la IA</Label>
                <textarea
                  id="instrucciones"
                  value={estilo.instrucciones}
                  maxLength={400}
                  rows={3}
                  placeholder="Ej: empezá por el costo total y compará siempre contra el mes anterior."
                  onChange={(e) => set("instrucciones", e.target.value)}
                  className="w-full rounded-xl border border-line bg-card px-3 py-2 text-sm placeholder:text-ink-3 focus-visible:border-ink focus-visible:outline-none"
                />
                <p className="text-[11px] text-ink-3">La IA las respeta, pero nunca por encima de usar solo los números del tablero.</p>
              </div>
              <Button variant="outline" className="w-full" onClick={guardarEstilo} disabled={guardando}>
                <Save /> Guardar estilo
              </Button>
            </aside>
            <section className="min-h-0 overflow-y-auto bg-paper-2/40 p-5 sm:p-8">
              {borrador ? (
                <div className="mx-auto max-w-2xl rounded-2xl border border-line bg-card p-6 shadow-sm sm:p-10">
                  {vozCambio && (
                    <p className="mb-6 rounded-xl bg-warn/10 px-3 py-2 text-xs text-warn">
                      Cambiaste el tono o las instrucciones: regenerá la vista previa para que la IA reescriba el texto.
                    </p>
                  )}
                  <ReporteVista titulo={borrador.titulo} contenido={borrador.contenido} datos={borrador.datos} estilo={vistaEstilo} subtitulo="Vista previa · todavía no se guardó" compacto />
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <Eye className="size-8 text-ink-3" />
                  <p className="font-serif text-2xl">Vista previa</p>
                  <p className="max-w-sm text-sm text-ink-2">La IA recalcula el tablero y redacta el reporte con tu estilo. No se guarda hasta que lo confirmes.</p>
                </div>
              )}
            </section>
          </div>
          <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4 sm:px-7">
            <Button variant="outline" onClick={previsualizar} disabled={redactando}>
              {redactando ? <Loader2 className="animate-spin" /> : <Eye />} {borrador ? "Regenerar vista previa" : "Generar vista previa"}
            </Button>
            <Button onClick={guardarReporte} disabled={!borrador || guardando || redactando}>
              {guardando ? <Loader2 className="animate-spin" /> : <Save />} Guardar reporte
            </Button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
