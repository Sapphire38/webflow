"use client";

import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Tipado mínimo de la Web Speech API (no está en lib.dom de TypeScript). */
interface Reconocimiento {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type Constructor = new () => Reconocimiento;

function constructor(): Constructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Constructor; webkitSpeechRecognition?: Constructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const soportado = () => constructor() !== null;
const nada = () => () => {};

/**
 * Dictado por voz en castellano (Chrome, Edge y Safari). Va escribiendo el texto en el
 * composer mientras hablás; al terminar queda para revisar antes de enviar.
 */
export function Microfono({ onTexto, deshabilitado }: { onTexto: (texto: string, final: boolean) => void; deshabilitado?: boolean }) {
  const disponible = useSyncExternalStore(nada, soportado, () => false);
  const [escuchando, setEscuchando] = useState(false);
  const rec = useRef<Reconocimiento | null>(null);

  useEffect(() => () => rec.current?.stop(), []);

  if (!disponible) return null;

  const alternar = () => {
    if (escuchando) {
      rec.current?.stop();
      return;
    }
    const C = constructor();
    if (!C) return;
    const r = new C();
    r.lang = navigator.language?.startsWith("es") ? navigator.language : "es-AR";
    r.interimResults = true;
    r.continuous = false;
    let acumulado = "";
    r.onresult = (e) => {
      let parcial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) acumulado += res[0].transcript;
        else parcial += res[0].transcript;
      }
      onTexto((acumulado + parcial).trim(), false);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") toast.error("Permití el micrófono en el navegador para dictar.");
      else if (e.error !== "no-speech" && e.error !== "aborted") toast.error("No pude escucharte. Probá de nuevo.");
    };
    r.onend = () => {
      setEscuchando(false);
      if (acumulado.trim()) onTexto(acumulado.trim(), true);
    };
    rec.current = r;
    try {
      r.start();
      setEscuchando(true);
    } catch {
      setEscuchando(false);
    }
  };

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={deshabilitado}
      aria-label={escuchando ? "Dejar de escuchar" : "Dictar por voz"}
      aria-pressed={escuchando}
      title={escuchando ? "Dejar de escuchar" : "Dictar por voz"}
      className={cn(
        "relative grid size-9 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-40",
        escuchando ? "bg-ember text-ember-ink" : "text-ink-2 hover:bg-paper-2 hover:text-ink",
      )}
    >
      {escuchando && <span className="absolute inset-0 animate-ping rounded-full bg-ember/40" aria-hidden />}
      {escuchando ? <Square className="relative size-3.5" /> : <Mic className="relative size-4" />}
    </button>
  );
}
