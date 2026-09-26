"use client";

import { ArrowDown, ArrowUp, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Presentacion } from "@/lib/data/chart";
import { cn } from "@/lib/utils";
import { actualizarWidget, borrarDashboard, crearDashboard, generarReporte, quitarWidget } from "../actions";

export function NuevoDashboard() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [pendiente, empezar] = useTransition();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        empezar(async () => {
          const r = await crearDashboard(nombre);
          if (!r.ok) return void toast.error(r.error);
          router.push(`/dashboards/${r.data?.id}`);
        });
      }}
    >
      <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del dashboard" aria-label="Nombre del dashboard" maxLength={80} className="w-56" />
      <Button type="submit" disabled={pendiente || !nombre.trim()}>
        {pendiente ? <Loader2 className="animate-spin" /> : <Plus />} Crear
      </Button>
    </form>
  );
}

export function BorrarDashboard({ id, nombre }: { id: string; nombre: string }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  return (
    <Button
      variant="danger"
      size="icon"
      aria-label={`Borrar ${nombre}`}
      disabled={pendiente}
      onClick={() => {
        if (!confirm(`¿Borrar el dashboard "${nombre}" y sus widgets?`)) return;
        empezar(async () => {
          const r = await borrarDashboard(id);
          if (!r.ok) return void toast.error(r.error);
          router.refresh();
        });
      }}
    >
      <Trash2 />
    </Button>
  );
}

export function GenerarReporte({ dashboardId, deshabilitado }: { dashboardId: string; deshabilitado: boolean }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  return (
    <Button
      variant="ember"
      disabled={pendiente || deshabilitado}
      onClick={() =>
        empezar(async () => {
          const r = await generarReporte(dashboardId);
          if (!r.ok) return void toast.error(r.error);
          router.push(`/reportes/${r.data?.id}`);
        })
      }
    >
      {pendiente ? <Loader2 className="animate-spin" /> : <FileText />} {pendiente ? "Escribiendo…" : "Generar reporte con IA"}
    </Button>
  );
}

const TIPOS: Presentacion["tipo"][] = ["grafico", "kpi", "tabla"];

export function AccionesWidget({
  id,
  dashboardId,
  presentacion,
  primero,
  ultimo,
}: {
  id: string;
  dashboardId: string;
  presentacion: Presentacion;
  primero: boolean;
  ultimo: boolean;
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const correr = (f: () => Promise<{ ok: boolean; error?: string }>) =>
    empezar(async () => {
      const r = await f();
      if (!r.ok) toast.error(r.error ?? "No se pudo actualizar.");
      router.refresh();
    });
  const btn = "rounded-md px-1.5 py-1 text-[11px] text-ink-3 hover:bg-paper-2 hover:text-ink disabled:opacity-40";
  return (
    <div className={cn("flex flex-wrap items-center gap-0.5", pendiente && "opacity-50")}>
      {TIPOS.map((t) => (
        <button
          key={t}
          type="button"
          className={cn(btn, presentacion.tipo === t && "bg-paper-2 text-ink")}
          aria-pressed={presentacion.tipo === t}
          onClick={() => correr(() => actualizarWidget(id, dashboardId, { presentacion: { ...presentacion, tipo: t } }))}
        >
          {t}
        </button>
      ))}
      <span className="mx-1 h-3 w-px bg-line" />
      {([1, 2, 3] as const).map((a) => (
        <button
          key={a}
          type="button"
          className={cn(btn, "num", presentacion.ancho === a && "bg-paper-2 text-ink")}
          aria-label={`Ancho ${a}`}
          aria-pressed={presentacion.ancho === a}
          onClick={() => correr(() => actualizarWidget(id, dashboardId, { presentacion: { ...presentacion, ancho: a } }))}
        >
          {a}×
        </button>
      ))}
      <span className="mx-1 h-3 w-px bg-line" />
      <button type="button" className={btn} disabled={primero} aria-label="Mover antes" onClick={() => correr(() => actualizarWidget(id, dashboardId, { mover: -1 }))}>
        <ArrowUp className="size-3.5" />
      </button>
      <button type="button" className={btn} disabled={ultimo} aria-label="Mover después" onClick={() => correr(() => actualizarWidget(id, dashboardId, { mover: 1 }))}>
        <ArrowDown className="size-3.5" />
      </button>
      <button type="button" className={cn(btn, "hover:text-danger")} aria-label="Quitar widget" onClick={() => correr(() => quitarWidget(id, dashboardId))}>
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
