"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowRight, BarChart3, CircleHelp, Database, FileText, MessageSquare, Pin, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Paso = {
  icono: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  titulo: string;
  texto: React.ReactNode;
  items?: string[];
  ir?: { href: string; label: string };
};

const PASOS: Paso[] = [
  {
    icono: Sparkles,
    eyebrow: "Bienvenida",
    titulo: "Conversá con tus datos",
    texto: (
      <>
        Insight convierte tus preguntas en cifras, gráficos, dashboards y reportes. El modelo traduce la pregunta a una consulta y
        un motor determinístico hace las cuentas: <strong>los números no los inventa la IA</strong>.
      </>
    ),
    items: ["Cargás datos", "Preguntás en el chat", "Guardás los gráficos en un dashboard", "Generás un reporte ejecutivo"],
  },
  {
    icono: Database,
    eyebrow: "Paso 1 · Datos",
    titulo: "Traé tus datos",
    texto: "En Datos cargás las fuentes que después vas a consultar. Si entraste con la cuenta demo, ya tenés 480 órdenes de trabajo de mantenimiento listas.",
    items: [
      "Subir un CSV o cargar el dataset de ejemplo",
      "Importar una hoja de Google Sheets por link",
      "Conectar una API REST que devuelva JSON",
      "Importar planillas desde Google Drive",
      "Actualizar una fuente remota con un click",
    ],
    ir: { href: "/datos", label: "Ir a Datos" },
  },
  {
    icono: MessageSquare,
    eyebrow: "Paso 2 · Chat",
    titulo: "Preguntá como a un analista",
    texto: "Escribí la pregunta o tocá una de las sugerencias. El chat responde con cifras, tablas y gráficos, y podés repreguntar para afinar.",
    items: [
      "“¿Cuánto gastamos en mantenimiento por planta?”",
      "“Mostrame la evolución mensual de órdenes correctivas”",
      "“¿Qué equipo consume más horas? Graficalo”",
    ],
    ir: { href: "/chat", label: "Abrir el chat" },
  },
  {
    icono: Pin,
    eyebrow: "Paso 3 · Guardar",
    titulo: "Fijá lo que te sirve",
    texto: (
      <>
        Debajo de cada gráfico está <strong>Guardar en dashboard</strong>. Elegís si se muestra como gráfico, KPI o tabla, el ancho y el
        tablero. Se guarda la receta, no una foto: cada vez que lo abrís se recalcula con los datos actuales.
      </>
    ),
  },
  {
    icono: BarChart3,
    eyebrow: "Paso 4 · Dashboards",
    titulo: "Armá tableros vivos",
    texto: "En Dashboards creás tableros y ordenás sus widgets: cambiar el ancho, moverlos o quitarlos. La cuenta demo trae “Mantenimiento 2026” con cinco widgets.",
    ir: { href: "/dashboards", label: "Ver dashboards" },
  },
  {
    icono: FileText,
    eyebrow: "Paso 5 · Reportes",
    titulo: "Pedile el resumen a la IA",
    texto: (
      <>
        Dentro de un dashboard, <strong>Reporte con IA</strong> recalcula los widgets y escribe un resumen ejecutivo usando solo esas
        cifras. Antes de generarlo lo ves en vista previa y le das tu estilo.
      </>
    ),
    items: [
      "Estilo propio: color de acento, tipografía, pie de página y tono",
      "Instrucciones para la IA sobre qué destacar",
      "Programar envío: recibirlo por Slack o email cada día, semana o mes",
      "Imprimir o exportar a PDF",
    ],
    ir: { href: "/reportes", label: "Ver reportes" },
  },
];

/** Por usuario: en una misma PC pueden entrar varias cuentas (la demo y la propia). */
const clave = (userId: string) => `insight:tutorial-visto:${userId}`;

const sinSuscripcion = () => () => {};

// Sin storage (modo privado, bloqueado) cuenta como visto: no se abre solo, queda el botón.
function yaLoVio(userId: string) {
  try {
    return localStorage.getItem(clave(userId)) !== null;
  } catch {
    return true;
  }
}

export function Tutorial({ userId }: { userId: string }) {
  // En el servidor cuenta como visto, así no aparece un flash del modal antes de hidratar.
  const visto = useSyncExternalStore(sinSuscripcion, () => yaLoVio(userId), () => true);
  const [forzado, setForzado] = useState<boolean | null>(null);
  const [paso, setPaso] = useState(0);
  // La primera vez se abre solo; después manda lo que haga el usuario.
  const abierto = forzado ?? !visto;

  const cambiar = (v: boolean) => {
    setForzado(v);
    if (v) {
      setPaso(0);
      return;
    }
    try {
      localStorage.setItem(clave(userId), "1");
    } catch {}
  };

  const actual = PASOS[paso];
  const Icono = actual.icono;
  const ultimo = paso === PASOS.length - 1;

  return (
    <Dialog.Root open={abierto} onOpenChange={cambiar}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-full p-2 text-ink-2 hover:bg-paper-2 hover:text-ink md:px-3 md:py-1.5 md:text-xs"
          aria-label="Cómo usar Insight"
        >
          <CircleHelp className="size-4" />
          <span className="hidden md:inline">Guía</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-4 top-[8vh] z-50 mx-auto flex max-h-[84vh] max-w-xl flex-col overflow-y-auto rounded-2xl border border-line bg-paper p-6 shadow-2xl sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ember text-ember-ink">
              <Icono className="size-5" />
            </span>
            <Dialog.Close className="rounded-full p-2 text-ink-2 hover:bg-paper-2" aria-label="Cerrar">
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div key={paso} className="rise mt-5">
            <p className="num text-[11px] uppercase tracking-[0.2em] text-ember">{actual.eyebrow}</p>
            <Dialog.Title className="mt-2 font-serif text-4xl leading-tight tracking-tight">{actual.titulo}</Dialog.Title>
            <Dialog.Description className="mt-3 text-[15px] text-ink-2">{actual.texto}</Dialog.Description>
            {actual.items && (
              <ul className="mt-5 space-y-2">
                {actual.items.map((item, i) => (
                  <li key={item} className="flex gap-3 rounded-xl border border-line bg-card px-4 py-2.5 text-sm text-ink-2">
                    <span className="num text-ember">0{i + 1}</span>
                    {item}
                  </li>
                ))}
              </ul>
            )}
            {actual.ir && (
              <Button asChild variant="outline" size="sm" className="mt-5">
                <Link href={actual.ir.href} onClick={() => cambiar(false)}>
                  {actual.ir.label} <ArrowRight />
                </Link>
              </Button>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between gap-4 border-t border-line pt-5">
            <div className="flex gap-1.5" role="group" aria-label={`Paso ${paso + 1} de ${PASOS.length}`}>
              {PASOS.map((p, i) => (
                <button
                  key={p.titulo}
                  type="button"
                  onClick={() => setPaso(i)}
                  aria-label={`Ir al paso ${i + 1}`}
                  aria-current={i === paso ? "step" : undefined}
                  className={cn("h-1.5 rounded-full transition-all", i === paso ? "w-6 bg-ember" : "w-1.5 bg-line hover:bg-ink-3")}
                />
              ))}
            </div>
            <div className="flex gap-2">
              {paso > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => setPaso(paso - 1)}>
                  <ArrowLeft /> Anterior
                </Button>
              ) : (
                <Dialog.Close asChild>
                  <Button variant="ghost" size="sm">
                    Saltar
                  </Button>
                </Dialog.Close>
              )}
              {ultimo ? (
                <Dialog.Close asChild>
                  <Button variant="ember" size="sm">
                    Empezar
                  </Button>
                </Dialog.Close>
              ) : (
                <Button size="sm" onClick={() => setPaso(paso + 1)}>
                  Siguiente <ArrowRight />
                </Button>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
