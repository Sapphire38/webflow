import { describe, expect, it } from "vitest";
import { ESTILO_BASE, estiloSchema, instruccionesDeEstilo, leerEstilo, tintaSobre } from "@/lib/data/estilo";

describe("estilo de reportes", () => {
  it("completa defaults y normaliza el color", () => {
    expect(estiloSchema.parse({ acento: "#1F4E79" })).toEqual({ ...ESTILO_BASE, acento: "#1f4e79" });
  });
  it("rechaza colores o textos inválidos (terminan en CSS y en el prompt)", () => {
    expect(estiloSchema.safeParse({ acento: "red;background:url(x)" }).success).toBe(false);
    expect(estiloSchema.safeParse({ instrucciones: "x".repeat(401) }).success).toBe(false);
    expect(estiloSchema.safeParse({ tono: "sarcastico" }).success).toBe(false);
  });
  it("lee estilos guardados rotos sin romper", () => {
    expect(leerEstilo({ acento: "nope" })).toEqual(ESTILO_BASE);
    expect(leerEstilo(null)).toEqual(ESTILO_BASE);
  });
  it("elige tinta legible sobre el acento", () => {
    expect(tintaSobre("#ffe600")).toBe("#16140f");
    expect(tintaSobre("#1f4e79")).toBe("#ffffff");
  });
  it("arma las instrucciones del prompt con tono e indicaciones", () => {
    const t = instruccionesDeEstilo({ ...ESTILO_BASE, tono: "cercano", instrucciones: "Mencioná siempre el costo" });
    expect(t).toMatch(/Tono cercano/);
    expect(t).toMatch(/Mencioná siempre el costo/);
  });
});
