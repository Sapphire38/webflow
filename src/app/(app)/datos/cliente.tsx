"use client";

import { FileUp, Loader2, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MAX_BYTES, parsearCsv } from "@/lib/data/csv";
import { cn } from "@/lib/utils";
import { borrarDataset, cargarEjemplo, crearDataset } from "../actions";

export function SubirCsv() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [pendiente, empezar] = useTransition();

  const procesar = (archivo: File | undefined) => {
    if (!archivo) return;
    if (!/\.(csv|txt)$/i.test(archivo.name)) return toast.error("Por ahora solo CSV (con cabecera).");
    if (archivo.size > MAX_BYTES) return toast.error("El archivo supera los 2 MB.");
    empezar(async () => {
      try {
        // Se parsea en el navegador para no subir el archivo crudo; el servidor re-valida.
        const { filas, truncado } = parsearCsv(await archivo.text());
        const r = await crearDataset(archivo.name.replace(/\.(csv|txt)$/i, ""), filas);
        if (!r.ok) return void toast.error(r.error);
        toast.success(truncado ? "Dataset creado con las primeras 5.000 filas." : "Dataset creado.");
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setArrastrando(true);
      }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastrando(false);
        procesar(e.dataTransfer.files[0]);
      }}
      disabled={pendiente}
      className={cn(
        "flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
        arrastrando ? "border-ember bg-ember-soft/50" : "border-line hover:border-ink",
      )}
    >
      {pendiente ? <Loader2 className="size-6 animate-spin text-ember" /> : <FileUp className="size-6 text-ember" />}
      <span className="font-medium">{pendiente ? "Procesando…" : "Arrastrá un CSV o hacé click para elegirlo"}</span>
      <span className="text-xs text-ink-3">Hasta 2 MB y 5.000 filas. La primera fila tiene que ser la cabecera.</span>
      <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => procesar(e.target.files?.[0])} />
    </button>
  );
}

export function CargarEjemplo() {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  return (
    <Button
      variant="ember"
      disabled={pendiente}
      onClick={() =>
        empezar(async () => {
          const r = await cargarEjemplo();
          if (!r.ok) return void toast.error(r.error);
          toast.success("Cargamos 480 órdenes de trabajo de ejemplo.");
          router.refresh();
        })
      }
    >
      {pendiente ? <Loader2 className="animate-spin" /> : <Sparkles />} Usar dataset de ejemplo
    </Button>
  );
}

export function BorrarDataset({ id, nombre }: { id: string; nombre: string }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  return (
    <Button
      variant="danger"
      size="icon"
      aria-label={`Borrar ${nombre}`}
      disabled={pendiente}
      onClick={() => {
        if (!confirm(`¿Borrar "${nombre}"? Los widgets que lo usan van a dejar de tener datos.`)) return;
        empezar(async () => {
          const r = await borrarDataset(id);
          if (!r.ok) return void toast.error(r.error);
          router.refresh();
        });
      }}
    >
      {pendiente ? <Loader2 className="animate-spin" /> : <Trash2 />}
    </Button>
  );
}
