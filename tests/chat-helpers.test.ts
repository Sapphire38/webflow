import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { sinCjk } from "@/lib/chat/limpiar";
import { conIds, tituloDesde } from "@/lib/chat/titulo";
import { systemPrompt } from "@/lib/server/prompt";

const msg = (role: "user" | "assistant", text: string): UIMessage => ({ id: text, role, parts: [{ type: "text", text }] });

describe("tituloDesde", () => {
  it("usa el primer mensaje del usuario y colapsa espacios", () => {
    expect(tituloDesde([msg("assistant", "hola"), msg("user", "  ¿Cuánto   gastamos? ")])).toBe("¿Cuánto gastamos?");
  });
  it("corta en 60 caracteres con elipsis", () => {
    const t = tituloDesde([msg("user", "a".repeat(100))]);
    expect(t).toHaveLength(60);
    expect(t.endsWith("…")).toBe(true);
  });
  it("sin texto devuelve el título por defecto", () => {
    expect(tituloDesde([])).toBe("Nueva conversación");
  });
});

describe("systemPrompt", () => {
  it("incluye la fecha en Argentina, el usuario y la regla de no inventar", () => {
    const p = systemPrompt("Ada", new Date("2026-09-26T01:00:00Z"));
    expect(p).toMatch(/viernes, 25 de septiembre de 2026/);
    expect(p).toContain("Ada");
    expect(p).toMatch(/Nunca inventes/);
    expect(p).toContain("agregar_dataset");
  });
});

describe("conIds", () => {
  it("completa ids vacíos y desduplica sin tocar los válidos", () => {
    const r = conIds([msg("user", "a"), { ...msg("assistant", "b"), id: "" }, { ...msg("assistant", "c"), id: "" }, { ...msg("user", "d"), id: "a" }]);
    const ids = r.map((m) => m.id);
    expect(ids[0]).toBe("a");
    expect(new Set(ids).size).toBe(4);
    expect(ids.every(Boolean)).toBe(true);
  });
});

describe("sinCjk", () => {
  it("saca ideogramas colados por el modelo sin romper el castellano", () => {
    expect(sinCjk("casi 持平 con tablero eléctrico (4,73 h).")).toBe("casi con tablero eléctrico (4,73 h).")
    expect(sinCjk("Córdoba lidera 続く, seguida")).toBe("Córdoba lidera, seguida");
    expect(sinCjk("Ñandú ¿qué? ¡sí! €100")).toBe("Ñandú ¿qué? ¡sí! €100");
  });
});
