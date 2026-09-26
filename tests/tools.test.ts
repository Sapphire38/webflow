import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { datasetDeEjemplo } from "@/lib/data/sample";
import { herramientas } from "@/lib/server/tools";

const ej = datasetDeEjemplo();
const DS = { id: "ds-1", nombre: ej.nombre, campos: ej.campos, filas: ej.filas, cantidad_filas: ej.filas.length, origen: "ejemplo", created_at: "2026-09-25" };

/** Doble mínimo del query builder de supabase-js: solo lo que usan las tools. */
function supabaseFalso() {
  const maybeSingle = vi.fn(async function (this: { _id?: string }) {
    return { data: this._id === DS.id ? DS : null, error: null };
  });
  const builder = {
    _id: undefined as string | undefined,
    select() {
      return this;
    },
    order: async () => ({ data: [DS], error: null }),
    eq(_col: string, v: string) {
      this._id = v;
      return this;
    },
    match() {
      return this;
    },
    maybeSingle,
  };
  const from = vi.fn(() => ({ ...builder }));
  return { client: { from } as unknown as SupabaseClient, from, maybeSingle };
}

const opts = { toolCallId: "t", messages: [] } as never;

describe("tools del chat", () => {
  it("listar_datasets expone id, filas y campos", async () => {
    const { client } = supabaseFalso();
    const r = (await herramientas(client).listar_datasets.execute!({}, opts)) as { datasets: { datasetId: string; filas: number }[] };
    expect(r.datasets[0]).toMatchObject({ datasetId: "ds-1", filas: 480 });
  });

  it("agregar_dataset calcula con el motor y reutiliza la carga del dataset", async () => {
    const { client, maybeSingle } = supabaseFalso();
    const t = herramientas(client);
    const a = (await t.agregar_dataset.execute!({ datasetId: "ds-1", consulta: { operacion: "contar" } }, opts)) as { datos: { valor: number }[] };
    await t.agregar_dataset.execute!({ datasetId: "ds-1", consulta: { operacion: "contar", agruparPor: "planta" } }, opts);
    expect(a.datos[0].valor).toBe(480);
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("graficar devuelve un spec con receta reproducible", async () => {
    const { client } = supabaseFalso();
    const consulta = { agruparPor: "planta", operacion: "sumar" as const, campo: "costo" };
    const r = (await herramientas(client).graficar.execute!({ tipo: "barras", titulo: "Costo por planta", datasetId: "ds-1", consulta }, opts)) as {
      spec: { datos: unknown[]; receta: unknown };
    };
    expect(r.spec.datos).toHaveLength(4);
    expect(r.spec.receta).toEqual({ datasetId: "ds-1", consulta });
  });

  it("los errores vuelven como datos para que el modelo se corrija", async () => {
    const { client } = supabaseFalso();
    const t = herramientas(client);
    const malCampo = (await t.agregar_dataset.execute!({ datasetId: "ds-1", consulta: { operacion: "sumar", campo: "precio" } }, opts)) as { error: string; codigo: string };
    expect(malCampo.codigo).toBe("CAMPO_INEXISTENTE");
    expect(malCampo.error).toMatch(/Válidos:/);
    const sinDs = (await t.ver_muestra.execute!({ datasetId: "otro", limite: 3 }, opts)) as { codigo: string };
    expect(sinDs.codigo).toBe("DATASET_INEXISTENTE");
  });

  it("proyectar devuelve lo real, lo proyectado y una receta que se puede guardar", async () => {
    const { client } = supabaseFalso();
    const consulta = { agruparPor: "fecha", granularidad: "semana" as const, operacion: "sumar" as const, campo: "costo" };
    const r = (await herramientas(client).proyectar.execute!({ titulo: "Costo semanal", datasetId: "ds-1", consulta, horizonte: 4 }, opts)) as {
      spec: { tipo: string; datos: unknown[]; receta: unknown; proyeccion: { metodo: string; proyectado: unknown[]; errorPct: number | null } };
    };
    expect(r.spec.tipo).toBe("linea");
    expect(r.spec.receta).toEqual({ datasetId: "ds-1", consulta, proyeccion: { horizonte: 4 } });
    expect(r.spec.proyeccion.metodo).toBe("holt");
    expect(r.spec.proyeccion.proyectado).toHaveLength(4);
    expect(r.spec.proyeccion.errorPct).not.toBeNull();
  });

  it("proyectar explica cuando no hay historia suficiente", async () => {
    const { client } = supabaseFalso();
    const consulta = { agruparPor: "fecha", granularidad: "trimestre" as const, operacion: "contar" as const };
    const r = (await herramientas(client).proyectar.execute!({ titulo: "x", datasetId: "ds-1", consulta, horizonte: 2 }, opts)) as { codigo: string };
    expect(r.codigo).toBe("POCOS_PERIODOS");
  });

  it("sugerir_preguntas deduplica y limita a 3", async () => {
    const { client } = supabaseFalso();
    const r = (await herramientas(client).sugerir_preguntas.execute!({ preguntas: ["Abrilo por planta", "Abrilo por planta", "¿Y por mes?"] }, opts)) as { preguntas: string[] };
    expect(r.preguntas).toEqual(["Abrilo por planta", "¿Y por mes?"]);
  });
});
