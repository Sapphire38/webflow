"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, Pin, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { guardarWidget } from "@/app/(app)/actions";
import { VistaWidget } from "@/components/chart/chart-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ChartSpec, Presentacion } from "@/lib/data/chart";
import { cn } from "@/lib/utils";

const TIPOS: { v: Presentacion["tipo"]; label: string }[] = [
  { v: "grafico", label: "Gráfico" },
  { v: "kpi", label: "KPI" },
  { v: "tabla", label: "Tabla" },
];

export function GuardarEnDashboard({ spec, dashboards }: { spec: ChartSpec; dashboards: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState(spec.titulo);
  const [tipo, setTipo] = useState<Presentacion["tipo"]>("grafico");
  const [ancho, setAncho] = useState<1 | 2 | 3>(1);
  const [destino, setDestino] = useState<string>(dashboards[0]?.id ?? "nuevo");
  const [nuevo, setNuevo] = useState("Mi dashboard");
  const [pendiente, empezar] = useTransition();
  const presentacion: Presentacion = { tipo, ancho, agregado: tipo === "kpi" ? "suma" : undefined };

  const guardar = () =>
    empezar(async () => {
      const r = await guardarWidget({
        destino: destino === "nuevo" ? { nuevo } : { dashboardId: destino },
        titulo,
        viz: { tipo: spec.tipo, titulo, unidad: spec.unidad, horizontal: spec.horizontal },
        receta: spec.receta,
        presentacion,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setAbierto(false);
      toast.success("Guardado en el dashboard", {
        action: { label: "Abrir", onClick: () => router.push(`/dashboards/${r.data?.dashboardId}`) },
      });
      router.refresh();
    });

  return (
    <Dialog.Root open={abierto} onOpenChange={setAbierto}>
      <Dialog.Trigger asChild>
        <Button variant="outline" size="sm">
          <Pin /> Guardar en dashboard
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-4 top-[6vh] z-50 mx-auto max-h-[88vh] max-w-2xl overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-2xl sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-serif text-3xl">Guardar en un dashboard</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-ink-2">
                Se guarda la receta, no una foto: cada vez que abras el dashboard se recalcula con los datos actuales.
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-full p-2 text-ink-2 hover:bg-paper-2" aria-label="Cerrar">
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="titulo">Título</Label>
                <Input id="titulo" value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} />
              </div>
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium uppercase tracking-[0.08em] text-ink-2">Mostrar como</legend>
                <div className="flex gap-2 pt-1">
                  {TIPOS.map((t) => (
                    <button
                      key={t.v}
                      type="button"
                      onClick={() => setTipo(t.v)}
                      aria-pressed={tipo === t.v}
                      className={cn("rounded-full border px-3 py-1.5 text-sm", tipo === t.v ? "border-ink bg-ink text-paper" : "border-line hover:border-ink")}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium uppercase tracking-[0.08em] text-ink-2">Ancho</legend>
                <div className="flex gap-2 pt-1">
                  {([1, 2, 3] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAncho(a)}
                      aria-pressed={ancho === a}
                      className={cn("num rounded-full border px-3 py-1.5 text-sm", ancho === a ? "border-ink bg-ink text-paper" : "border-line hover:border-ink")}
                    >
                      {a} col
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="space-y-2">
                <Label htmlFor="destino">Dashboard</Label>
                <select
                  id="destino"
                  value={destino}
                  onChange={(e) => setDestino(e.target.value)}
                  className="h-11 w-full rounded-xl border border-line bg-card px-3 text-sm"
                >
                  {dashboards.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nombre}
                    </option>
                  ))}
                  <option value="nuevo">+ Crear uno nuevo</option>
                </select>
                {destino === "nuevo" && <Input aria-label="Nombre del dashboard nuevo" value={nuevo} maxLength={80} onChange={(e) => setNuevo(e.target.value)} />}
              </div>
            </div>
            <div className="rounded-xl border border-line bg-card p-4">
              <p className="mb-2 text-xs uppercase tracking-[0.12em] text-ink-3">Vista previa</p>
              <p className="font-medium">{titulo}</p>
              <VistaWidget spec={spec} presentacion={presentacion} />
            </div>
          </div>
          <div className="mt-8 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost">Cancelar</Button>
            </Dialog.Close>
            <Button onClick={guardar} disabled={pendiente || !titulo.trim()}>
              {pendiente && <Loader2 className="animate-spin" />} Guardar
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
