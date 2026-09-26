"use client";

import { Player } from "@remotion/player";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { ALTO, ANCHO, DURACION_LOGIN, DURACION_SIGNUP, EscenaLogin, EscenaSignup, FPS } from "@/components/auth/escenas";

const MOVIMIENTO_REDUCIDO = "(prefers-reduced-motion: reduce)";

function suscribir(cb: () => void) {
  const mq = window.matchMedia(MOVIMIENTO_REDUCIDO);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** El alta cuenta el recorrido completo; el resto de las pantallas de auth, el momento de la respuesta. */
export function AnimacionAuth() {
  const alta = usePathname().endsWith("/signup");
  const reducido = useSyncExternalStore(suscribir, () => window.matchMedia(MOVIMIENTO_REDUCIDO).matches, () => false);
  const duracion = alta ? DURACION_SIGNUP : DURACION_LOGIN;

  return (
    <div aria-hidden className="mt-12">
      <Player
        key={`${alta}-${reducido}`}
        component={alta ? EscenaSignup : EscenaLogin}
        durationInFrames={duracion}
        fps={FPS}
        compositionWidth={ANCHO}
        compositionHeight={ALTO}
        style={{ width: "100%", aspectRatio: `${ANCHO} / ${ALTO}` }}
        // Con movimiento reducido queda quieta en el cuadro donde ya está todo dibujado.
        autoPlay={!reducido}
        loop={!reducido}
        initialFrame={reducido ? duracion - 30 : 0}
        controls={false}
        // Sin audio: si no arranca silenciado, el Player espera a que el navegador habilite el AudioContext
        // (requiere un gesto del usuario) y queda congelado en el primer cuadro.
        initiallyMuted
        clickToPlay={false}
        spaceKeyToPlayOrPause={false}
        doubleClickToFullscreen={false}
        allowFullscreen={false}
      />
    </div>
  );
}
