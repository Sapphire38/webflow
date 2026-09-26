import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/*
 * Composiciones de Remotion para el panel del login y del alta. Se dibujan sobre el panel oscuro
 * (bg-ink), así que el "papel" es el color de texto. Todo sale de los tokens de globals.css.
 */

export const FPS = 30;
export const ANCHO = 560;
export const ALTO = 460;

const tenue = (pct: number) => `color-mix(in srgb, var(--paper) ${pct}%, transparent)`;
const serif = "var(--font-instrument-serif), serif";
const mono = "var(--font-geist-mono), ui-monospace, monospace";
const sans = "var(--font-geist-sans), system-ui, sans-serif";

/** Fundido al final para que el loop no corte en seco. */
function useFundidoLoop(salida = 18) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return interpolate(frame, [0, 8, durationInFrames - salida, durationInFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

const aparecer = (frame: number, fps: number, desde: number) => spring({ frame: frame - desde, fps, config: { damping: 16, mass: 0.7 } });

/* ─── Login: pregunta → respuesta → gráfico ─────────────────────────────── */

export const DURACION_LOGIN = 190;

const PREGUNTA = "¿Cuánto gastamos por planta?";
const PLANTAS = [
  { nombre: "Norte", valor: 3.1 },
  { nombre: "Sur", valor: 2.4 },
  { nombre: "Este", valor: 4.2 },
  { nombre: "Oeste", valor: 2.7 },
];
const TOTAL = PLANTAS.reduce((s, p) => s + p.valor, 0);
const MAX = Math.max(...PLANTAS.map((p) => p.valor));
/** En px: con % la columna flex las achicaba a todas por igual para que entren las etiquetas. */
const BARRA_MAX = 110;

export function EscenaLogin() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacidad = useFundidoLoop();

  const letras = Math.floor(interpolate(frame, [6, 48], [0, PREGUNTA.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const burbuja = aparecer(frame, fps, 0);
  const pensando = frame >= 52 && frame < 72;
  const respuesta = aparecer(frame, fps, 72);
  const total = interpolate(frame, [76, 120], [0, TOTAL], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill style={{ opacity: opacidad, fontFamily: sans, color: "var(--paper)", padding: 8 }}>
      {/* Pregunta del usuario */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div
          style={{
            transform: `translateY(${(1 - burbuja) * 16}px)`,
            opacity: burbuja,
            background: "var(--ember)",
            color: "var(--ember-ink)",
            borderRadius: "22px 22px 6px 22px",
            padding: "14px 20px",
            fontSize: 22,
            minHeight: 26,
          }}
        >
          {PREGUNTA.slice(0, letras)}
          {letras < PREGUNTA.length && <span style={{ opacity: frame % 16 < 8 ? 1 : 0 }}>▍</span>}
        </div>
      </div>

      {/* El motor calculando */}
      {pensando && (
        <div style={{ display: "flex", gap: 8, marginTop: 28 }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 9,
                height: 9,
                borderRadius: 9,
                background: "var(--paper)",
                opacity: interpolate(Math.sin((frame - i * 4) / 3), [-1, 1], [0.2, 1]),
              }}
            />
          ))}
        </div>
      )}

      {/* Respuesta: KPI + barras */}
      <div
        style={{
          marginTop: 24,
          opacity: respuesta,
          transform: `translateY(${(1 - respuesta) * 20}px)`,
          border: `1px solid ${tenue(18)}`,
          borderRadius: 18,
          padding: 22,
          background: tenue(5),
        }}
      >
        <p style={{ fontFamily: mono, fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", color: tenue(55), margin: 0 }}>
          Costo total · 2026
        </p>
        <p style={{ fontFamily: serif, fontSize: 64, lineHeight: 1, margin: "8px 0 0" }}>
          $ {total.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} M
        </p>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 18, marginTop: 22 }}>
          {PLANTAS.map((p, i) => {
            const crecer = aparecer(frame, fps, 92 + i * 7);
            const destacada = p.valor === MAX;
            return (
              <div key={p.nombre} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: mono, fontSize: 13, opacity: crecer, color: destacada ? "var(--ember)" : tenue(70) }}>{p.valor.toLocaleString("es-AR")}</span>
                <div
                  style={{
                    width: "100%",
                    height: (p.valor / MAX) * BARRA_MAX * crecer,
                    flexShrink: 0,
                    borderRadius: "8px 8px 3px 3px",
                    background: destacada ? "var(--ember)" : tenue(24),
                    boxShadow: destacada ? "0 0 32px -6px var(--ember)" : undefined,
                  }}
                />
                <span style={{ fontSize: 13, color: tenue(60) }}>{p.nombre}</span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

/* ─── Alta: CSV → gráfico → dashboard ───────────────────────────────────── */

export const DURACION_SIGNUP = 220;

const FILAS = [
  ["2026-01-04", "Norte", "Correctivo", "184.000"],
  ["2026-01-09", "Este", "Preventivo", "92.500"],
  ["2026-02-12", "Sur", "Correctivo", "240.300"],
  ["2026-02-20", "Oeste", "Predictivo", "61.800"],
  ["2026-03-02", "Este", "Correctivo", "133.900"],
];
const PASOS = ["Subís un CSV", "Preguntás", "Tu dashboard"];
/** Área interior de la tarjeta del CSV (ANCHO menos paddings), para interpolar posiciones en px. */
const AREA_ANCHO = ANCHO - 16 - 40;
const AREA_ALTO = 250;
const LINEA = [0.3, 0.45, 0.38, 0.62, 0.55, 0.8, 0.72, 0.95];
const LINEA_W = 200;
const LINEA_H = 180;
const PTS = LINEA.map((v, i) => [(i / (LINEA.length - 1)) * LINEA_W, LINEA_H - v * LINEA_H] as const);
const PUNTOS_LINEA = PTS.map(([x, y]) => `${x},${y}`).join(" ");
/** Largo real de la polilínea, para dibujarla con stroke-dashoffset. */
const LARGO_LINEA = PTS.slice(1).reduce((s, [x, y], i) => s + Math.hypot(x - PTS[i][0], y - PTS[i][1]), 0);

export function EscenaSignup() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacidad = useFundidoLoop();
  const pasoActual = frame < 70 ? 0 : frame < 125 ? 1 : 2;

  // Del CSV al gráfico: las filas se encogen hasta volverse barras.
  const morph = interpolate(frame, [70, 100], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const archivo = aparecer(frame, fps, 0);
  const dashboard = aparecer(frame, fps, 128);
  const trazo = interpolate(frame, [145, 185], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) });
  const kpi = interpolate(frame, [140, 175], [0, 480], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill style={{ opacity: opacidad, fontFamily: sans, color: "var(--paper)", padding: 8 }}>
      {/* Stepper */}
      <div style={{ display: "flex", gap: 10 }}>
        {PASOS.map((p, i) => {
          const activo = i === pasoActual;
          const hecho = i < pasoActual;
          return (
            <div
              key={p}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: 999,
                fontSize: 14,
                border: `1px solid ${activo ? "var(--ember)" : tenue(18)}`,
                background: activo ? "var(--ember)" : "transparent",
                color: activo ? "var(--ember-ink)" : hecho ? "var(--paper)" : tenue(50),
              }}
            >
              <span style={{ fontFamily: mono, fontSize: 12 }}>{hecho ? "✓" : `0${i + 1}`}</span>
              {p}
            </div>
          );
        })}
      </div>

      <div style={{ position: "relative", flex: 1, marginTop: 26 }}>
        {/* Archivo CSV que se convierte en barras */}
        {frame < 128 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: archivo * interpolate(frame, [116, 127], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              transform: `scale(${0.94 + archivo * 0.06})`,
              border: `1px solid ${tenue(18)}`,
              borderRadius: 18,
              padding: 20,
              background: tenue(5),
            }}
          >
            <p style={{ fontFamily: mono, fontSize: 13, color: tenue(55), margin: "0 0 14px" }}>ordenes.csv · 480 filas</p>
            <div style={{ position: "relative", height: AREA_ALTO }}>
              {FILAS.map((fila, i) => {
                const entrar = aparecer(frame, fps, 10 + i * 8);
                const barraAlto = 70 + ((i * 53) % 140);
                const barraAncho = (AREA_ANCHO - 10 * (FILAS.length - 1)) / FILAS.length;
                const mezcla = (a: number, b: number, t = morph) => a + (b - a) * t;
                // El ancho se achica antes que la posición: así las barras no se pisan mientras se acomodan.
                const achicar = Math.min(1, morph * 1.6);
                return (
                  <div
                    key={fila[0]}
                    style={{
                      position: "absolute",
                      left: mezcla(0, i * (barraAncho + 10)),
                      top: mezcla(i * 46, AREA_ALTO - barraAlto),
                      width: mezcla(AREA_ANCHO, barraAncho, achicar),
                      height: mezcla(36, barraAlto),
                      opacity: entrar,
                      translate: `0 ${(1 - entrar) * -24}px`,
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "0 12px",
                      borderRadius: 8,
                      background: i === 2 ? `color-mix(in srgb, var(--ember) ${morph * 100}%, ${tenue(8)})` : tenue(8 + morph * 16),
                      fontFamily: mono,
                      fontSize: 13,
                      color: tenue(80),
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {fila.map((c, j) => (
                      <span key={c} style={{ flex: j === 0 ? 1.3 : 1, opacity: 1 - morph * 3, color: j === 3 ? "var(--ember)" : undefined }}>
                        {c}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dashboard */}
        {frame >= 128 && (
          <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "1fr 1.4fr", gridTemplateRows: "1fr 1fr", gap: 14 }}>
            <Tile entrada={dashboard} demora={0} frame={frame} fps={fps} titulo="Órdenes">
              <p style={{ fontFamily: serif, fontSize: 58, lineHeight: 1, margin: 0 }}>{Math.round(kpi)}</p>
            </Tile>
            <Tile entrada={dashboard} demora={6} frame={frame} fps={fps} titulo="Evolución mensual" filas={2}>
              <svg viewBox={`0 0 ${LINEA_W} ${LINEA_H}`} style={{ width: "100%", height: "100%", overflow: "visible" }} aria-hidden>
                <polyline
                  points={PUNTOS_LINEA}
                  fill="none"
                  stroke="var(--ember)"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={LARGO_LINEA}
                  strokeDashoffset={LARGO_LINEA * trazo}
                />
              </svg>
            </Tile>
            <Tile entrada={dashboard} demora={12} frame={frame} fps={fps} titulo="Por tipo">
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, width: "100%" }}>
                {[0.9, 0.55, 0.3].map((v, i) => (
                  <div
                    key={v}
                    style={{
                      flex: 1,
                      height: v * 70 * aparecer(frame, fps, 150 + i * 6),
                      borderRadius: "6px 6px 2px 2px",
                      background: i === 0 ? "var(--ember)" : tenue(24),
                    }}
                  />
                ))}
              </div>
            </Tile>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
}

function Tile({
  entrada,
  demora,
  frame,
  fps,
  titulo,
  filas = 1,
  children,
}: {
  entrada: number;
  demora: number;
  frame: number;
  fps: number;
  titulo: string;
  filas?: 1 | 2;
  children: React.ReactNode;
}) {
  const e = demora === 0 ? entrada : aparecer(frame, fps, 128 + demora);
  return (
    <div
      style={{
        gridRow: filas === 2 ? "span 2" : undefined,
        opacity: e,
        transform: `translateY(${(1 - e) * 18}px) scale(${0.96 + e * 0.04})`,
        border: `1px solid ${tenue(18)}`,
        borderRadius: 16,
        padding: 16,
        background: tenue(5),
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <p style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: tenue(55), margin: 0 }}>{titulo}</p>
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "flex-end" }}>{children}</div>
    </div>
  );
}
