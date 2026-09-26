import { afterEach, describe, expect, it, vi } from "vitest";
import { extraerFilas, FuenteRemotaError, sanearHeaders, urlCsvDeSheets, validarUrlPublica } from "@/lib/data/remote";
import { cifrar, descifrar } from "@/lib/server/cifrado";
import { crearState, verificarState } from "@/lib/server/drive";
import { importarApi, importarSheets } from "@/lib/server/remote";

const ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789";

describe("urlCsvDeSheets", () => {
  it("convierte el link de edición en export CSV conservando la pestaña", () => {
    expect(urlCsvDeSheets(`https://docs.google.com/spreadsheets/d/${ID}/edit#gid=42`)).toBe(
      `https://docs.google.com/spreadsheets/d/${ID}/export?format=csv&gid=42`,
    );
    expect(urlCsvDeSheets(`https://docs.google.com/spreadsheets/d/${ID}/edit?usp=sharing`)).toBe(
      `https://docs.google.com/spreadsheets/d/${ID}/export?format=csv`,
    );
  });
  it("rechaza links que no son de Sheets", () => {
    expect(() => urlCsvDeSheets("https://evil.com/spreadsheets/d/xxxxxxxxxxxxxxxxxxxxxxxx")).toThrow(FuenteRemotaError);
    expect(() => urlCsvDeSheets("no es un link")).toThrow(/link completo/);
  });
});

describe("validarUrlPublica (anti-SSRF)", () => {
  it.each([
    "http://localhost:5432",
    "http://127.0.0.1/admin",
    "http://10.0.0.5",
    "http://192.168.1.1",
    "http://172.20.0.1",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
    "http://metadata.google.internal",
    "file:///etc/passwd",
    "https://user:pass@api.com",
  ])("rechaza %s", (u) => {
    expect(() => validarUrlPublica(u)).toThrow(FuenteRemotaError);
  });
  it("acepta URLs públicas", () => {
    expect(validarUrlPublica("https://api.github.com/repos").hostname).toBe("api.github.com");
  });
});

describe("extraerFilas", () => {
  it("encuentra la primera lista de objetos y aplana un nivel", () => {
    const json = { meta: { total: 2 }, data: { items: [{ id: 1, planta: { nombre: "Córdoba" }, tags: ["a"] }, { id: 2, planta: { nombre: "Rosario" } }] } };
    expect(extraerFilas(json)).toEqual([
      { id: 1, "planta.nombre": "Córdoba", tags: '["a"]' },
      { id: 2, "planta.nombre": "Rosario" },
    ]);
  });
  it("respeta el path indicado y explica cuando no hay lista", () => {
    expect(extraerFilas({ a: { b: [{ x: 1 }] } }, "a.b")).toEqual([{ x: 1 }]);
    expect(() => extraerFilas({ a: 1 }, "a")).toThrow(/no hay una lista/);
    expect(() => extraerFilas({ a: [] })).toThrow(/vacía/);
  });
});

describe("sanearHeaders", () => {
  it("ignora vacíos y bloquea headers peligrosos o con inyección", () => {
    expect(sanearHeaders([{ nombre: " Authorization ", valor: "Bearer x" }, { nombre: "", valor: "y" }])).toEqual({ Authorization: "Bearer x" });
    expect(() => sanearHeaders([{ nombre: "Host", valor: "evil" }])).toThrow();
    expect(() => sanearHeaders([{ nombre: "X-A", valor: "a\r\nX-B: b" }])).toThrow(/saltos/);
    expect(() => sanearHeaders([{ nombre: "X A", valor: "a" }])).toThrow(/inválidos/);
  });
});

describe("cifrado AES-GCM", () => {
  const S = "un-secreto-de-prueba-largo";
  it("ida y vuelta, con IV distinto cada vez", async () => {
    const a = await cifrar("token-123", S);
    const b = await cifrar("token-123", S);
    expect(a).not.toBe(b);
    expect(a.startsWith("v1.")).toBe(true);
    expect(await descifrar(a, S)).toBe("token-123");
  });
  it("falla con otra clave o si se altera el sobre", async () => {
    const a = await cifrar("x", S);
    await expect(descifrar(a, "otra-clave-distinta-larga")).rejects.toThrow();
    await expect(descifrar(`${a.slice(0, -2)}AA`, S)).rejects.toThrow();
  });
});

describe("state de OAuth de Drive", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("solo lo acepta el mismo usuario y antes de vencer", async () => {
    vi.stubEnv("FUENTES_SECRET", "secreto-de-test-suficientemente-largo");
    const s = await crearState("user-a");
    await expect(verificarState(s, "user-a")).resolves.toBeUndefined();
    await expect(verificarState(s, "user-b")).rejects.toThrow(/otra sesión/);
    await expect(verificarState("basura", "user-a")).rejects.toThrow(/no es válido/);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 11 * 60_000);
    await expect(verificarState(s, "user-a")).rejects.toThrow(/venció/);
    vi.useRealTimers();
  });
});

describe("importadores con fetch simulado", () => {
  afterEach(() => vi.unstubAllGlobals());
  const responder = (body: string, init: ResponseInit & { url?: string } = {}) => {
    const r = new Response(body, init);
    Object.defineProperty(r, "url", { value: init.url ?? "https://api.ejemplo.com/x" });
    return r;
  };

  it("importa una API JSON y manda los headers", async () => {
    const f = vi.fn(async () => responder(JSON.stringify({ data: [{ planta: "A", costo: 10 }, { planta: "B", costo: 5 }] })));
    vi.stubGlobal("fetch", f);
    const r = await importarApi({ url: "https://api.ejemplo.com/x" }, { Authorization: "Bearer t" });
    expect(r.filas).toHaveLength(2);
    expect(r.campos.find((c) => c.nombre === "costo")?.tipo).toBe("numero");
    expect((f.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toMatchObject({ Authorization: "Bearer t" });
  });

  it("bloquea redirects hacia la red interna", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responder("[]", { url: "http://169.254.169.254/" })));
    await expect(importarApi({ url: "https://api.ejemplo.com/x" }, {})).rejects.toThrow(/privada/);
  });

  it("explica cuando la hoja no está compartida", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responder("<html>login</html>", { headers: { "content-type": "text/html" }, url: "https://docs.google.com/x" })));
    await expect(importarSheets(`https://docs.google.com/spreadsheets/d/${ID}/edit`)).rejects.toThrow(/Cualquier persona con el enlace/);
  });

  it("importa el CSV de una hoja pública", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responder("mes,ventas\nene,10\nfeb,20", { headers: { "content-type": "text/csv" }, url: "https://docs.google.com/x" })));
    const r = await importarSheets(`https://docs.google.com/spreadsheets/d/${ID}/edit`);
    expect(r.filas).toEqual([{ mes: "ene", ventas: 10 }, { mes: "feb", ventas: 20 }]);
  });
});
