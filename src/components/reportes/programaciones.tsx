"use client";

import { CheckCircle2, Loader2, Pause, Play, Send, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { alternarProgramacion, borrarProgramacion, enviarAhora } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ProgramacionVista {
  id: string;
  dashboardId: string;
  dashboard: string;
  descripcion: string;
  timezone: string;
  destinos: { canal: string; direccion: string }[];
  activa: boolean;
  /** Fechas ya formateadas en el servidor: formatearlas acá daría distinto en Node y en el navegador (hidratación). */
  proxima: string | null;
  ultima: { at: string; ok: boolean; error?: string | null; enviados?: number } | null;
  envios: { id: string; canal: string; destinatario: string; estado: string; error: string | null; fecha: string }[];
}

export function Programaciones({ items }: { items: ProgramacionVista[] }) {
  return (
    <ul className="mt-6 space-y-4">
      {items.map((p) => (
        <Item key={p.id} p={p} />
      ))}
    </ul>
  );
}

function Item({ p }: { p: ProgramacionVista }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const correr = (f: () => Promise<{ ok: boolean; error?: string }>, ok?: string) =>
    empezar(async () => {
      const r = await f();
      if (!r.ok) toast.error(r.error ?? "No se pudo.");
      else if (ok) toast.success(ok);
      router.refresh();
    });
  return (
    <li className={cn("rounded-2xl border border-line bg-card p-5", !p.activa && "opacity-70")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/dashboards/${p.dashboardId}`} className="font-serif text-2xl hover:text-ember">
            {p.dashboard}
          </Link>
          <p className="mt-1 text-sm text-ink-2">
            {p.descripcion} <span className="text-ink-3">({p.timezone})</span>
          </p>
          <p className="num mt-2 text-xs text-ink-3">
            {p.activa ? (p.proxima ? `Próximo: ${p.proxima}` : "Sin próxima fecha") : "Pausada"}
            {p.ultima && (
              <>
                {" · "}Último: {p.ultima.at}{" "}
                <span className={p.ultima.ok ? "text-ok" : "text-danger"}>{p.ultima.ok ? "ok" : "con errores"}</span>
              </>
            )}
          </p>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {p.destinos.map((d) => (
              <li key={d.direccion} className="num rounded-full border border-line px-2.5 py-1 text-xs">
                {d.canal} · {d.direccion}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="ember"
            disabled={pendiente}
            onClick={() =>
              empezar(async () => {
                const r = await enviarAhora(p.id);
                if (!r.ok) toast.error(r.error);
                else if (r.data?.errores.length) toast.warning(`Enviado a ${r.data.enviados}; falló: ${r.data.errores.join(" · ")}`);
                else toast.success(`Reporte enviado a ${r.data?.enviados} destino(s).`);
                router.refresh();
              })
            }
          >
            {pendiente ? <Loader2 className="animate-spin" /> : <Send />} Enviar ahora
          </Button>
          <Button size="sm" variant="ghost" disabled={pendiente} onClick={() => correr(() => alternarProgramacion(p.id, !p.activa), p.activa ? "Pausada." : "Reactivada.")}>
            {p.activa ? <Pause /> : <Play />} {p.activa ? "Pausar" : "Activar"}
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={pendiente}
            aria-label="Borrar programación"
            onClick={() => {
              if (confirm("¿Borrar esta programación?")) correr(() => borrarProgramacion(p.id));
            }}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
      {p.envios.length > 0 && (
        <details className="mt-4 border-t border-line pt-3">
          <summary className="cursor-pointer text-xs uppercase tracking-[0.12em] text-ink-3">Últimos envíos ({p.envios.length})</summary>
          <ul className="mt-2 space-y-1.5 text-sm">
            {p.envios.map((e) => (
              <li key={e.id} className="flex items-start gap-2">
                {e.estado === "enviado" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />}
                <span className="num text-xs text-ink-3">{e.fecha}</span>
                <span className="min-w-0 truncate text-ink-2">
                  {e.canal} · {e.destinatario}
                  {e.error && <span className="text-danger"> — {e.error}</span>}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}
