import { type Fila, inferirCampos } from "./engine";

/**
 * Dataset de ejemplo: órdenes de trabajo de mantenimiento, el caso de uso de
 * Enterprise. Es determinístico (PRNG con semilla) para que la cuenta demo y los
 * tests vean siempre los mismos números.
 */
function prng(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const PLANTAS = ["Córdoba", "Rosario", "Mendoza", "Neuquén"];
const TIPOS = ["Correctivo", "Preventivo", "Predictivo", "Mejora"];
const EQUIPOS = ["Compresor", "Caldera", "Cinta transportadora", "Bomba", "Tablero eléctrico", "Autoelevador"];
const ESTADOS = ["Cerrada", "Cerrada", "Cerrada", "En curso", "Pendiente"];
const PRIORIDADES = ["Alta", "Media", "Baja"];

export const NOMBRE_EJEMPLO = "Órdenes de trabajo (ejemplo)";

export function ordenesDeEjemplo(cantidad = 480): Fila[] {
  const r = prng(38);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const inicio = Date.UTC(2026, 0, 1);
  return Array.from({ length: cantidad }, (_, i) => {
    const tipo = pick(TIPOS);
    const fecha = new Date(inicio + Math.floor(r() * 265) * 86_400_000);
    const horas = Math.round((tipo === "Correctivo" ? 3 + r() * 9 : 1 + r() * 5) * 10) / 10;
    return {
      orden: `OT-${String(1000 + i)}`,
      fecha: fecha.toISOString().slice(0, 10),
      planta: pick(PLANTAS),
      equipo: pick(EQUIPOS),
      tipo,
      prioridad: pick(PRIORIDADES),
      estado: pick(ESTADOS),
      horas,
      costo: Math.round(horas * (18000 + r() * 12000)),
    };
  });
}

export function datasetDeEjemplo() {
  const filas = ordenesDeEjemplo();
  return { nombre: NOMBRE_EJEMPLO, filas, campos: inferirCampos(filas) };
}
