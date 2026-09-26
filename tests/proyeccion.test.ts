import { describe, expect, it } from "vitest";
import { resolverReceta } from "@/lib/data/chart";
import { ConsultaError, type Fila, inferirCampos, serieTemporal } from "@/lib/data/engine";
import { pronosticar, proyectar } from "@/lib/data/proyeccion";
import { contextoProyeccion } from "@/lib/server/reportes";

/** Una fila por mes, el último día, con el valor dado: meses cerrados. */
function mensual(valores: number[], desde = [2024, 0]): Fila[] {
  return valores.map((v, i) => {
    const d = new Date(Date.UTC(desde[0], desde[1] + i + 1, 0));
    return { fecha: d.toISOString().slice(0, 10), monto: v };
  });
}
const consulta = { agruparPor: "fecha", granularidad: "mes" as const, operacion: "sumar" as const, campo: "monto" };
const etiquetas = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

describe("serieTemporal", () => {
  it("completa los meses sin filas con 0 si la operación es aditiva", () => {
    const filas = [...mensual([10]), { fecha: "2024-03-31", monto: 30 }];
    const s = serieTemporal(filas, inferirCampos(filas), consulta);
    expect(s.puntos.map((p) => p.valor)).toEqual([10, 0, 30]);
    expect(s.parcial).toBeUndefined();
  });

  it("interpola los huecos de un promedio en vez de ponerlos en cero", () => {
    const filas = [...mensual([10]), { fecha: "2024-03-31", monto: 30 }];
    const s = serieTemporal(filas, inferirCampos(filas), { ...consulta, operacion: "promedio" });
    expect(s.puntos.map((p) => p.valor)).toEqual([10, 20, 30]);
  });

  it("marca como parcial el último período si los datos terminan antes de que cierre", () => {
    const filas = [...mensual([10, 20]), { fecha: "2024-03-10", monto: 5 }];
    expect(serieTemporal(filas, inferirCampos(filas), consulta).parcial).toBe("mar/24");
  });

  it("exige agrupar por fecha", () => {
    const filas = [{ planta: "A", monto: 1 }];
    expect(() => serieTemporal(filas, inferirCampos(filas), { agruparPor: "planta", operacion: "contar" })).toThrow(/campo de fecha/);
  });
});

describe("pronosticar", () => {
  it("con pocos períodos usa una recta, y si la serie es una recta le erra 0%", () => {
    const p = pronosticar([10, 20, 30, 40, 50, 60], "mes", etiquetas(2));
    expect(p.metodo).toBe("lineal");
    expect(p.proyectado.map((x) => x.valor)).toEqual([70, 80]);
    expect(p.errorPct).toBe(0);
  });

  it("con dos temporadas completas modela la estacionalidad", () => {
    const patron = [5, 6, 8, 12, 15, 18, 20, 19, 14, 10, 7, 5];
    const y = [...patron, ...patron.map((v) => v + 2), ...patron.slice(0, 3).map((v) => v + 4)];
    const p = pronosticar(y, "mes", etiquetas(12));
    expect(p.metodo).toBe("holt_winters");
    // La serie termina en marzo: el pico de julio cae en el cuarto período proyectado.
    const pico = p.proyectado.reduce((a, x, i) => (x.valor > p.proyectado[a].valor ? i : a), 0);
    expect(pico).toBe(3);
    const esperado = patron.slice(3).map((v) => v + 4);
    esperado.forEach((v, i) => expect(Math.abs(p.proyectado[i].valor - v) / v).toBeLessThan(0.3));
    expect(p.errorPct).not.toBeNull();
  });

  it("el rango se abre con el horizonte y nunca baja de cero si la serie no fue negativa", () => {
    const p = pronosticar([50, 5, 60, 2, 55, 3, 40, 1, 30, 0], "semana", etiquetas(4));
    expect(p.metodo).toBe("holt");
    const anchos = p.proyectado.map((x) => x.alto - x.bajo);
    expect(anchos[3]).toBeGreaterThan(anchos[0]);
    expect(p.proyectado.every((x) => x.bajo >= 0 && x.valor >= 0)).toBe(true);
  });

  it("rechaza series cortas con un error que el modelo puede leer", () => {
    expect(() => pronosticar([1, 2, 3], "mes", etiquetas(1))).toThrow(ConsultaError);
    expect(() => pronosticar([1, 2, 3], "mes", etiquetas(1))).toThrow(/al menos 6/);
  });
});

describe("proyectar", () => {
  it("etiqueta los períodos futuros y proyecta el período en curso en vez de mostrarlo", () => {
    const filas = [...mensual([10, 20, 30, 40, 50, 60]), { fecha: "2024-07-05", monto: 1 }];
    const { historico, proyeccion } = proyectar(filas, inferirCampos(filas), consulta, { horizonte: 2 });
    expect(historico.at(-1)).toEqual({ etiqueta: "jun/24", valor: 60 });
    expect(proyeccion.parcial).toBe("jul/24");
    expect(proyeccion.proyectado.map((p) => [p.etiqueta, p.valor])).toEqual([
      ["jul/24", 70],
      ["ago/24", 80],
    ]);
  });

  it("cruza el año con las etiquetas bien", () => {
    const filas = mensual([1, 2, 3, 4, 5, 6], [2024, 6]);
    const { proyeccion } = proyectar(filas, inferirCampos(filas), consulta, { horizonte: 1 });
    expect(proyeccion.proyectado[0].etiqueta).toBe("ene/25");
  });
});

describe("escenarios", () => {
  /** Dos plantas que crecen distinto: A suma 10 por mes, B suma 1. */
  const filas: Fila[] = [
    ...mensual([10, 20, 30, 40, 50, 60]).map((f) => ({ ...f, planta: "A" })),
    ...mensual([1, 2, 3, 4, 5, 6]).map((f) => ({ ...f, planta: "B" })),
  ];
  const campos = inferirCampos(filas);

  it("sin segmento escala toda la proyección", () => {
    const { proyeccion } = proyectar(filas, campos, consulta, { horizonte: 2, escenarios: [{ nombre: "+10%", cambioPct: 10 }] });
    expect(proyeccion.proyectado.map((p) => p.valor)).toEqual([77, 88]);
    expect(proyeccion.escenarios?.[0]).toEqual({
      nombre: "+10%",
      valores: [
        { etiqueta: "jul/24", valor: 84.7 },
        { etiqueta: "ago/24", valor: 96.8 },
      ],
      diferenciaPct: 10,
    });
  });

  it("con segmento solo cambia la parte de ese segmento", () => {
    const { proyeccion } = proyectar(filas, campos, consulta, {
      horizonte: 1,
      escenarios: [{ nombre: "B se duplica", cambioPct: 100, segmento: { planta: "B" } }],
    });
    // Base 77 (A proyecta 70, B proyecta 7): duplicar B suma 7.
    expect(proyeccion.escenarios?.[0].valores[0].valor).toBe(84);
  });

  it("no deja cambiar un segmento de una métrica que no se suma por partes", () => {
    expect(() =>
      proyectar(filas, campos, { ...consulta, operacion: "promedio" }, {
        horizonte: 1,
        escenarios: [{ nombre: "x", cambioPct: 10, segmento: { planta: "B" } }],
      }),
    ).toThrow(/solo se puede con sumar o contar/);
  });

  it("una caída del 90% deja el 10% de la base", () => {
    const { proyeccion } = proyectar(filas, campos, consulta, { horizonte: 1, escenarios: [{ nombre: "Crisis", cambioPct: -90 }] });
    expect(proyeccion.escenarios?.[0].valores[0].valor).toBeCloseTo(7.7);
  });
});

describe("metas", () => {
  const filas = mensual([10, 20, 30, 40, 50, 60]);
  const campos = inferirCampos(filas);
  const conMeta = (meta: { valor: number; tipo?: "periodo" | "acumulado"; sentido?: "superar" | "bajar" }) =>
    proyectar(filas, campos, consulta, { horizonte: 3, meta }).proyeccion.meta;

  it("dice en qué período se alcanza una meta por período", () => {
    // Recta perfecta: sin desvío, la probabilidad es de todo o nada.
    expect(conMeta({ valor: 80 })).toMatchObject({ alcanzaEn: "ago/24", probabilidad: 100, tipo: "periodo", sentido: "superar" });
  });

  it("si no se alcanza en el horizonte lo dice", () => {
    expect(conMeta({ valor: 500 })).toMatchObject({ alcanzaEn: null, probabilidad: 0 });
  });

  it("una meta acumulada suma los períodos proyectados", () => {
    // 70 + 80 = 150 al segundo período.
    expect(conMeta({ valor: 150, tipo: "acumulado" })?.alcanzaEn).toBe("ago/24");
  });

  it("un tope acumulado se evalúa al final del horizonte", () => {
    // 70 + 80 + 90 = 240.
    expect(conMeta({ valor: 200, tipo: "acumulado", sentido: "bajar" })).toMatchObject({ alcanzaEn: null, probabilidad: 0 });
    expect(conMeta({ valor: 250, tipo: "acumulado", sentido: "bajar" })?.alcanzaEn).toBe("sep/24");
  });

  it("con ruido la probabilidad refleja la incertidumbre", () => {
    const ruido = [100, 120, 95, 130, 110, 140, 105, 150, 125, 160];
    const f = mensual(ruido);
    const p = proyectar(f, inferirCampos(f), consulta, { horizonte: 3, meta: { valor: 1e6 } }).proyeccion;
    const cerca = proyectar(f, inferirCampos(f), consulta, { horizonte: 3, meta: { valor: p.proyectado[0].valor } }).proyeccion;
    expect(p.meta?.probabilidad).toBe(0);
    expect(cerca.meta?.probabilidad).toBe(50);
  });
});

describe("contextoProyeccion", () => {
  it("le da al reporte las cifras, el rango, el error y la meta", () => {
    const filas = mensual([10, 20, 30, 40, 50, 60]);
    const { proyeccion } = proyectar(filas, inferirCampos(filas), consulta, {
      horizonte: 1,
      escenarios: [{ nombre: "Suba", cambioPct: 10 }],
      meta: { valor: 70 },
    });
    const texto = contextoProyeccion(proyeccion, "ARS");
    expect(texto).toContain("error medido en el backtest: ±0%");
    expect(texto).toContain("jul/24: 70 ARS (entre 70 y 70)");
    expect(texto).toContain('Escenario "Suba": +10%');
    expect(texto).toContain("se alcanza en jul/24 con probabilidad 100%");
  });
});

describe("resolverReceta", () => {
  const filas = mensual([10, 20, 30, 40, 50, 60]);
  const campos = inferirCampos(filas);

  it("sin proyección es la agregación de siempre", () => {
    const r = resolverReceta(filas, campos, { datasetId: "d", consulta });
    expect(r.proyeccion).toBeUndefined();
    expect(r.datos).toHaveLength(6);
  });

  it("con proyección recalcula lo real y lo proyectado", () => {
    const r = resolverReceta(filas, campos, { datasetId: "d", consulta, proyeccion: { horizonte: 3 } });
    expect(r.datos.at(-1)?.valor).toBe(60);
    expect(r.proyeccion?.proyectado).toHaveLength(3);
  });
});
