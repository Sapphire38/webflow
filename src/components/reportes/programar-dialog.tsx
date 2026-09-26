"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { CalendarClock, Hash, Loader2, Mail, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { crearProgramacion } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DIAS, describir, FRECUENCIAS, type Recurrencia } from "@/lib/data/programacion";
import { cn } from "@/lib/utils";

type DestinoForm = { canal: "slack" | "email"; direccion: string };

export function ProgramarEnvio({ dashboardId, emailDisponible }: { dashboardId: string; emailDisponible: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [frecuencia, setFrecuencia] = useState<Recurrencia["frecuencia"]>("semanal");
  const [hora, setHora] = useState("09:00");
  const [diaSemana, setDiaSemana] = useState(1);
  const [diaMes, setDiaMes] = useState(1);
  const tzNavegador = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "America/Argentina/Buenos_Aires";
  const [timezone, setTimezone] = useState(tzNavegador || "America/Argentina/Buenos_Aires");
  const [destinos, setDestinos] = useState<DestinoForm[]>([{ canal: "slack", direccion: "" }]);
  const [pendiente, empezar] = useTransition();
  const recurrencia: Recurrencia = { frecuencia, hora, timezone, diaSemana: frecuencia === "semanal" ? diaSemana : undefined, diaMes: frecuencia === "mensual" ? diaMes : undefined };

  const guardar = () =>
    empezar(async () => {
      const r = await crearProgramacion({ dashboardId, recurrencia, destinos: destinos.filter((d) => d.direccion.trim()) });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Programado. Próximo envío: ${new Date(r.data?.proxima ?? "").toLocaleString("es-AR", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" })}`, {
        action: { label: "Ver", onClick: () => router.push("/reportes") },
      });
      setAbierto(false);
      router.refresh();
    });

  const chip = (activo: boolean) => cn("rounded-full border px-3 py-1.5 text-sm", activo ? "border-ink bg-ink text-paper" : "border-line hover:border-ink");

  return (
    <Dialog.Root open={abierto} onOpenChange={setAbierto}>
      <Dialog.Trigger asChild>
        <Button variant="outline">
          <CalendarClock /> Programar envío
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-4 top-[6vh] z-50 mx-auto max-h-[88vh] max-w-xl overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-2xl sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-serif text-3xl">Programar envío</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-ink-2">
                En cada corrida se recalculan los widgets, la IA escribe el resumen y se manda a los destinos.
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded-full p-2 text-ink-2 hover:bg-paper-2" aria-label="Cerrar">
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div className="mt-6 space-y-5">
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium uppercase tracking-[0.08em] text-ink-2">Frecuencia</legend>
              <div className="flex gap-2 pt-1">
                {FRECUENCIAS.map((f) => (
                  <button key={f} type="button" aria-pressed={frecuencia === f} onClick={() => setFrecuencia(f)} className={chip(frecuencia === f)}>
                    {f}
                  </button>
                ))}
              </div>
            </fieldset>
            {frecuencia === "semanal" && (
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium uppercase tracking-[0.08em] text-ink-2">Día</legend>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {DIAS.map((d, i) => (
                    <button key={d} type="button" aria-pressed={diaSemana === i + 1} onClick={() => setDiaSemana(i + 1)} className={chip(diaSemana === i + 1)}>
                      {d.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="grid gap-4 sm:grid-cols-3">
              {frecuencia === "mensual" && (
                <div className="space-y-2">
                  <Label htmlFor="dia-mes">Día del mes</Label>
                  <Input id="dia-mes" type="number" min={1} max={28} value={diaMes} onChange={(e) => setDiaMes(Number(e.target.value))} />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="hora">Hora</Label>
                <Input id="hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
              </div>
              <div className={cn("space-y-2", frecuencia === "mensual" ? "" : "sm:col-span-2")}>
                <Label htmlFor="tz">Zona horaria</Label>
                <Input id="tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
              </div>
            </div>
            <p className="rounded-xl bg-paper-2 px-3 py-2 text-sm text-ink-2">{describir(recurrencia)} ({timezone})</p>

            <fieldset className="space-y-2">
              <legend className="text-xs font-medium uppercase tracking-[0.08em] text-ink-2">Destinos</legend>
              {destinos.map((d, i) => (
                <div key={i} className="flex gap-2">
                  <select
                    aria-label="Canal"
                    value={d.canal}
                    onChange={(e) => setDestinos(destinos.map((x, j) => (j === i ? { ...x, canal: e.target.value as DestinoForm["canal"] } : x)))}
                    className="h-11 rounded-xl border border-line bg-card px-3 text-sm"
                  >
                    <option value="slack">Slack</option>
                    <option value="email" disabled={!emailDisponible}>
                      Email{emailDisponible ? "" : " (no configurado)"}
                    </option>
                  </select>
                  <Input
                    aria-label="Dirección"
                    type={d.canal === "email" ? "email" : "url"}
                    value={d.direccion}
                    placeholder={d.canal === "slack" ? "https://hooks.slack.com/services/…" : "equipo@empresa.com"}
                    onChange={(e) => setDestinos(destinos.map((x, j) => (j === i ? { ...x, direccion: e.target.value } : x)))}
                  />
                  {destinos.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" aria-label="Quitar destino" onClick={() => setDestinos(destinos.filter((_, j) => j !== i))}>
                      <X />
                    </Button>
                  )}
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {destinos.length < 10 && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setDestinos([...destinos, { canal: emailDisponible ? "email" : "slack", direccion: "" }])}>
                    <Plus /> Agregar destino
                  </Button>
                )}
                <span className="flex items-center gap-1.5 text-xs text-ink-3">
                  <Hash className="size-3.5" /> Incoming Webhook de Slack
                  {emailDisponible && (
                    <>
                      <span>·</span> <Mail className="size-3.5" /> email
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-ink-3">Los webhooks se guardan cifrados y solo se muestran enmascarados.</p>
            </fieldset>
          </div>

          <div className="mt-8 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost">Cancelar</Button>
            </Dialog.Close>
            <Button onClick={guardar} disabled={pendiente || !destinos.some((d) => d.direccion.trim())}>
              {pendiente && <Loader2 className="animate-spin" />} Programar
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
