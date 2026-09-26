import { describe, expect, it } from "vitest";
import { agregar, ConsultaError, filtrar, inferirCampos, type Fila } from "@/lib/data/engine";
import { datasetDeEjemplo } from "@/lib/data/sample";

const filas: Fila[] = [
  { fecha: "2026-01-05", planta: "Córdoba", horas: 2, costo: 100 },
  { fecha: "2026-01-20", planta: "Rosario", horas: 4, costo: 300 },
  { fecha: "2026-02-03", planta: "Córdoba", horas: 6, costo: 200 },
  { fecha: "2026-03-15", planta: "", horas: "8", costo: 50 },
];
const campos = inferirCampos(filas);

describe("inferirCampos", () => {
  it("detecta fecha, texto y número (incluye strings numéricos)", () => {
    expect(campos).toEqual([
      { nombre: "fecha", tipo: "fecha" },
      { nombre: "planta", tipo: "texto" },
      { nombre: "horas", tipo: "numero" },
      { nombre: "costo", tipo: "numero" },
    ]);
  });
});

describe("agregar", () => {
  it("cuenta sin agrupar", () => {
    expect(agregar(filas, campos, { operacion: "contar" })).toEqual([{ etiqueta: "Cantidad", valor: 4 }]);
  });

  it("suma por categoría, ordena desc y rotula vacíos", () => {
    expect(agregar(filas, campos, { agruparPor: "planta", operacion: "sumar", campo: "costo" })).toEqual([
      { etiqueta: "Córdoba", valor: 300 },
      { etiqueta: "Rosario", valor: 300 },
      { etiqueta: "(sin dato)", valor: 50 },
    ]);
  });

  it("agrupa fechas por mes en orden cronológico", () => {
    expect(
      agregar(filas, campos, { agruparPor: "fecha", granularidad: "mes", operacion: "promedio", campo: "horas" }),
    ).toEqual([
      { etiqueta: "ene/26", valor: 3 },
      { etiqueta: "feb/26", valor: 6 },
      { etiqueta: "mar/26", valor: 8 },
    ]);
  });

  it("no distingue mayúsculas en los nombres de campo", () => {
    expect(agregar(filas, campos, { agruparPor: "PLANTA", operacion: "contar" })[0].valor).toBe(2);
  });

  it("junta el excedente del top en 'Otras' cuando la operación es aditiva", () => {
    const r = agregar(filas, campos, { agruparPor: "planta", operacion: "contar", top: 2 });
    expect(r).toEqual([
      { etiqueta: "Córdoba", valor: 2 },
      { etiqueta: "Otras", valor: 2 },
    ]);
  });

  it("explica los errores con los campos válidos", () => {
    expect(() => agregar(filas, campos, { agruparPor: "zona", operacion: "contar" })).toThrow(/Válidos: fecha/);
    expect(() => agregar(filas, campos, { operacion: "sumar" })).toThrow(ConsultaError);
    expect(() => agregar(filas, campos, { operacion: "sumar", campo: "planta" })).toThrow(/no es numérico/);
    expect(() => agregar(filas, campos, { agruparPor: "planta", granularidad: "mes", operacion: "contar" })).toThrow(
      /solo aplica/,
    );
  });

  it("falla con SIN_FILAS si los filtros no dejan nada", () => {
    try {
      agregar(filas, campos, { operacion: "contar", filtros: { planta: "Salta" } });
      expect.unreachable();
    } catch (e) {
      expect((e as ConsultaError).codigo).toBe("SIN_FILAS");
    }
  });
});

describe("filtrar", () => {
  it("aplica operadores y 'hasta' cubre el día completo", () => {
    expect(filtrar(filas, { fecha: { desde: "2026-01-20", hasta: "2026-02-03" } })).toHaveLength(2);
    expect(filtrar(filas, { horas: { gte: 4 } })).toHaveLength(3);
    expect(filtrar(filas, { planta: { in: ["córdoba"] } })).toHaveLength(2);
    expect(filtrar(filas, { planta: { contiene: "ros" } })).toHaveLength(1);
    expect(filtrar(filas, { planta: { ne: "Córdoba" } })).toHaveLength(2);
  });
});

describe("dataset de ejemplo", () => {
  it("es determinístico y trae los tipos esperados", () => {
    const a = datasetDeEjemplo();
    const b = datasetDeEjemplo();
    expect(a.filas).toEqual(b.filas);
    expect(a.filas).toHaveLength(480);
    expect(Object.fromEntries(a.campos.map((c) => [c.nombre, c.tipo]))).toMatchObject({
      fecha: "fecha",
      planta: "texto",
      horas: "numero",
      costo: "numero",
    });
  });
});
