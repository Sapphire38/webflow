import { describe, expect, it } from "vitest";
import { armarSpec, calcularKpi, graficarSchema } from "@/lib/data/chart";
import { MAX_FILAS, parsearCsv } from "@/lib/data/csv";

describe("parsearCsv", () => {
  it("parsea cabecera, tipos y descarta filas vacías", () => {
    const r = parsearCsv("fecha, planta ,horas\n2026-01-01,Córdoba,3\n\n2026-01-02,Rosario,4.5\n");
    expect(r.filas).toEqual([
      { fecha: "2026-01-01", planta: "Córdoba", horas: 3 },
      { fecha: "2026-01-02", planta: "Rosario", horas: 4.5 },
    ]);
    expect(r.campos.map((c) => c.tipo)).toEqual(["fecha", "texto", "numero"]);
    expect(r.truncado).toBe(false);
  });

  it("recorta a MAX_FILAS y lo avisa", () => {
    const csv = ["n", ...Array.from({ length: MAX_FILAS + 5 }, (_, i) => String(i))].join("\n");
    const r = parsearCsv(csv);
    expect(r.filas).toHaveLength(MAX_FILAS);
    expect(r.truncado).toBe(true);
  });

  it("rechaza un CSV sin filas", () => {
    expect(() => parsearCsv("a,b\n")).toThrow();
  });
});

describe("gráficos", () => {
  it("recorta la torta a 12 porciones y conserva la receta", () => {
    const datos = Array.from({ length: 20 }, (_, i) => ({ etiqueta: `c${i}`, valor: i }));
    const receta = { datasetId: "d1", consulta: { operacion: "contar" as const } };
    const spec = armarSpec({ tipo: "torta", titulo: "x" }, datos, receta);
    expect(spec.datos).toHaveLength(12);
    expect(spec.receta).toBe(receta);
  });

  it("valida la entrada de la tool graficar", () => {
    expect(graficarSchema.safeParse({ tipo: "barras", titulo: "t", datasetId: "d", consulta: {} }).success).toBe(true);
    expect(graficarSchema.safeParse({ tipo: "radar", titulo: "t", datasetId: "d", consulta: {} }).success).toBe(false);
  });

  it("calcula KPIs", () => {
    const d = [{ etiqueta: "a", valor: 2 }, { etiqueta: "b", valor: 4 }];
    expect(calcularKpi(d)).toBe(6);
    expect(calcularKpi(d, "promedio")).toBe(3);
    expect(calcularKpi(d, "cantidad")).toBe(2);
    expect(calcularKpi([], "max")).toBeNull();
  });
});
