"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, Database, Square, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { borrarConversacion } from "@/app/(app)/actions";
import { Grafico } from "@/components/chart/chart-view";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import type { ChartSpec } from "@/lib/data/chart";
import { conBase } from "@/lib/env";
import { cn } from "@/lib/utils";
import { GuardarEnDashboard } from "./guardar-dialog";
import { Markdown } from "./markdown";
import { Microfono } from "./microfono";

const ETIQUETAS: Record<string, string> = {
  listar_datasets: "Mirando tus datasets",
  ver_muestra: "Leyendo una muestra",
  agregar_dataset: "Haciendo las cuentas",
  graficar: "Armando el gráfico",
  proyectar: "Proyectando",
};

const SUGERENCIAS = [
  "¿Cuánto gastamos en mantenimiento por planta?",
  "Mostrame la evolución mensual de órdenes correctivas",
  "¿Qué equipo consume más horas? Graficalo",
  "Comparame el costo promedio por tipo de mantenimiento",
];

type ParteTool = { type: string; state: string; output?: unknown; errorText?: string };

export function Chat({
  id,
  inicial,
  titulo,
  hayDatos,
  dashboards,
}: {
  id: string;
  inicial: UIMessage[];
  titulo?: string;
  hayDatos: boolean;
  dashboards: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const nueva = inicial.length === 0;
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: conBase("/api/chat"),
        prepareSendMessagesRequest: ({ messages, id }) => ({ body: { id, message: messages[messages.length - 1] } }),
      }),
    [],
  );
  const { messages, sendMessage, status, stop, error } = useChat({
    id,
    messages: inicial,
    transport,
    onFinish: ({ isError }) => {
      if (isError) return;
      // En una conversación nueva solo cambiamos la URL: un refresh volvería a
      // renderizar /chat con otro id y perdería el estado del chat en curso.
      if (nueva) window.history.replaceState(null, "", conBase(`/chat/${id}`));
      else router.refresh();
    },
  });
  const ocupado = status === "submitted" || status === "streaming";
  const fin = useRef<HTMLDivElement>(null);
  useEffect(() => {
    fin.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  const enviar = (texto: string) => {
    const t = texto.trim();
    if (!t || ocupado) return;
    sendMessage({ text: t });
    setInput("");
  };

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] flex-col md:h-dvh">
      {titulo && (
        <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-3 md:px-8">
          <h1 className="truncate font-serif text-xl">{titulo}</h1>
          <form action={borrarConversacion.bind(null, id)}>
            <Button variant="danger" size="sm" type="submit">
              <Trash2 /> Borrar
            </Button>
          </form>
        </header>
      )}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8">
          {messages.length === 0 ? (
            <Vacio hayDatos={hayDatos} onSugerencia={enviar} />
          ) : (
            <ol className="space-y-8">
              {messages.map((m, i) => (
                <li key={m.id} className={cn("rise", m.role === "user" && "flex justify-end")}>
                  {m.role === "user" ? (
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-4 py-3 text-paper">
                      {m.parts.map((p, i) => (p.type === "text" ? <p key={`${m.id}-${i}`} className="whitespace-pre-wrap">{p.text}</p> : null))}
                    </div>
                  ) : (
                    <MensajeAsistente
                      mensaje={m}
                      dashboards={dashboards}
                      onSugerencia={i === messages.length - 1 && !ocupado ? enviar : undefined}
                    />
                  )}
                </li>
              ))}
              {status === "submitted" && (
                <li className="flex items-center gap-2 text-sm text-ink-3">
                  <Puntos /> Pensando…
                </li>
              )}
            </ol>
          )}
          {error && (
            <p role="alert" className="mt-6 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
              {error.message || "Algo salió mal. Probá de nuevo."}
            </p>
          )}
          <div ref={fin} />
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(input);
        }}
        className="border-t border-line bg-paper/80 px-4 py-4 backdrop-blur md:px-8"
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-line bg-card p-2 focus-within:border-ink">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar(input);
              }
            }}
            rows={1}
            placeholder="Preguntale algo a tus datos… o tocá el micrófono"
            aria-label="Mensaje"
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] outline-none placeholder:text-ink-3"
          />
          <Microfono deshabilitado={ocupado} onTexto={(t) => setInput(t)} />
          {ocupado ? (
            <Button type="button" size="icon" variant="outline" onClick={() => stop()} aria-label="Detener">
              <Square />
            </Button>
          ) : (
            <Button type="submit" size="icon" variant="ember" disabled={!input.trim()} aria-label="Enviar">
              <ArrowUp />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

function Puntos() {
  return (
    <span className="inline-flex gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 rounded-full bg-ember" style={{ animation: `pulse-dot 1s ${i * 0.15}s infinite` }} />
      ))}
    </span>
  );
}

function Vacio({ hayDatos, onSugerencia }: { hayDatos: boolean; onSugerencia: (t: string) => void }) {
  return (
    <div className="rise pt-[8vh]">
      <Logo conTexto={false} className="text-ink" />
      <h2 className="mt-6 font-serif text-5xl leading-[1] tracking-tight md:text-6xl">
        ¿Qué querés <em className="text-ember">saber</em> hoy?
      </h2>
      <p className="mt-3 max-w-lg text-ink-2">Preguntá como le preguntarías a un analista. Las cuentas las hace el motor, no el modelo.</p>
      {!hayDatos && (
        <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-ember/60 bg-ember-soft/40 p-4 text-sm">
          <Database className="size-4 text-ember" />
          <span className="flex-1">Todavía no cargaste datos.</span>
          <Button asChild size="sm" variant="ember">
            <Link href="/datos">Subir un CSV o usar el ejemplo</Link>
          </Button>
        </div>
      )}
      <div className="mt-10 grid gap-2 sm:grid-cols-2">
        {SUGERENCIAS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => onSugerencia(s)}
            className="rise group rounded-2xl border border-line bg-card p-4 text-left text-sm text-ink-2 transition-colors hover:border-ink hover:text-ink"
            style={{ animationDelay: `${120 + i * 60}ms` }}
          >
            <span className="num mr-2 text-ember">0{i + 1}</span>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function MensajeAsistente({
  mensaje,
  dashboards,
  onSugerencia,
}: {
  mensaje: UIMessage;
  dashboards: { id: string; nombre: string }[];
  onSugerencia?: (texto: string) => void;
}) {
  return (
    <div className="space-y-4 text-[15px] text-ink-2">
      {mensaje.parts.map((parte, i) => {
        const key = `${mensaje.id}-${i}`;
        if (parte.type === "text") return parte.text.trim() ? <Markdown key={key} texto={parte.text} /> : null;
        if (!parte.type.startsWith("tool-")) return null;
        const p = parte as unknown as ParteTool;
        const nombre = p.type.slice(5);
        if (nombre === "sugerir_preguntas") {
          const preguntas = (p.output as { preguntas?: string[] } | undefined)?.preguntas ?? [];
          // Solo en la última respuesta: en el historial serían botones que ya no aplican.
          if (!onSugerencia || p.state !== "output-available" || preguntas.length === 0) return null;
          return (
            <div key={key} className="rise flex flex-wrap gap-2 pt-1" role="group" aria-label="Preguntas sugeridas">
              {preguntas.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onSugerencia(q)}
                  className="rounded-full border border-line bg-card px-3.5 py-1.5 text-sm text-ink-2 transition-colors hover:border-ember hover:text-ink"
                >
                  <span className="mr-1.5 text-ember">↳</span>
                  {q}
                </button>
              ))}
            </div>
          );
        }
        const salida = p.output as { spec?: ChartSpec; error?: string; dataset?: string } | undefined;
        if ((nombre === "graficar" || nombre === "proyectar") && p.state === "output-available" && salida?.spec) {
          return (
            <figure key={key} className="rise rounded-2xl border border-line bg-card p-5">
              <figcaption className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-serif text-2xl text-ink">{salida.spec.titulo}</span>
                {salida.dataset && <span className="text-xs text-ink-3">{salida.dataset}</span>}
              </figcaption>
              <Grafico spec={salida.spec} />
              <div className="mt-4 flex justify-end">
                <GuardarEnDashboard spec={salida.spec} dashboards={dashboards} />
              </div>
            </figure>
          );
        }
        const enCurso = p.state === "input-streaming" || p.state === "input-available";
        const fallo = p.state === "output-error" || Boolean(salida?.error);
        return (
          <p key={key} className="flex items-center gap-2 text-xs text-ink-3">
            {enCurso ? <Puntos /> : <span className={cn("size-1.5 rounded-full", fallo ? "bg-warn" : "bg-ok")} />}
            <span className={cn(enCurso && "italic")}>
              {ETIQUETAS[nombre] ?? "Consultando"}
              {fallo && !enCurso ? " · reintentando" : enCurso ? "…" : ""}
            </span>
          </p>
        );
      })}
    </div>
  );
}
