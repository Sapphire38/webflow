import { describe, expect, it, vi } from "vitest";
import { filasDeItems } from "@/lib/data/webflow";
import { importarColeccion, listarColecciones, validarToken } from "@/lib/server/webflow";

const COL = "64a1b2c3d4e5f6a7b8c9d0e1";

describe("filasDeItems", () => {
  it("aplana fieldData, limpia rich text, toma URLs de imágenes y agrega estado y fechas", () => {
    const filas = filasDeItems([
      {
        id: "1",
        createdOn: "2026-03-10T12:00:00.000Z",
        lastPublished: "2026-03-11T09:00:00.000Z",
        isDraft: false,
        fieldData: { name: "Post A", views: 120, body: "<p>Hola <strong>mundo</strong></p>", cover: { url: "https://cdn/x.png", alt: null }, tags: ["a", "b"] },
      },
      { id: "2", isDraft: true, fieldData: { name: "Post B" } },
      { id: "3", isArchived: true, fieldData: { name: "Archivado" } },
    ]);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({ name: "Post A", views: 120, body: "Hola mundo", cover: "https://cdn/x.png", tags: "a, b", estado: "publicado", creado: "2026-03-10", publicado: "2026-03-11" });
    expect(filas[1]).toMatchObject({ name: "Post B", estado: "borrador", publicado: null });
  });
});

describe("API de Webflow (fetch simulado)", () => {
  const responder = (m: Record<string, unknown>) =>
    vi.fn(async (url: string) => {
      const clave = Object.keys(m).find((k) => url.includes(k));
      return clave ? Response.json(m[clave]) : new Response("no", { status: 404 });
    });

  it("lista colecciones de todos los sitios del token", async () => {
    const f = responder({ "/sites/s1/collections": { collections: [{ id: COL, displayName: "Blog" }] }, "/sites": { sites: [{ id: "s1", displayName: "Mi sitio" }] } });
    const r = await listarColecciones("t".repeat(30), f as unknown as typeof fetch);
    expect(r).toEqual([{ id: COL, nombre: "Blog", sitio: "Mi sitio" }]);
    expect((f.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toMatchObject({ Authorization: `Bearer ${"t".repeat(30)}` });
  });

  it("pagina los items y los convierte en dataset", async () => {
    const pagina = (offset: number) => ({
      items: Array.from({ length: offset === 0 ? 100 : 20 }, (_, i) => ({ id: `${offset + i}`, createdOn: "2026-01-02T00:00:00Z", fieldData: { name: `i${offset + i}`, precio: i } })),
      pagination: { total: 120, offset, limit: 100 },
    });
    const f = vi.fn(async (url: string) => Response.json(pagina(url.includes("offset=100") ? 100 : 0)));
    const r = await importarColeccion("t".repeat(30), COL, f as unknown as typeof fetch);
    expect(f.mock.calls.filter(([u]) => String(u).includes("/items"))).toHaveLength(2);
    expect(r.filas).toHaveLength(120);
    expect(r.campos.find((c) => c.nombre === "creado")?.tipo).toBe("fecha");
    expect(r.campos.find((c) => c.nombre === "precio")?.tipo).toBe("numero");
  });

  it("reemplaza los ids de campos Reference por el nombre del item referenciado", async () => {
    const CAT = "64a1b2c3d4e5f6a7b8c9d0ff";
    const f = vi.fn(async (url: string) => {
      if (url.endsWith(`/collections/${COL}`)) return Response.json({ fields: [{ slug: "category", type: "Reference", validations: { collectionId: CAT } }, { slug: "name", type: "PlainText" }] });
      if (url.includes(`/collections/${CAT}/items`)) return Response.json({ items: [{ id: "c1", fieldData: { name: "Arquitectura" } }], pagination: { total: 1 } });
      return Response.json({ items: [{ id: "p1", fieldData: { name: "Post", category: "c1" } }, { id: "p2", fieldData: { name: "Otro", category: "zz" } }], pagination: { total: 2 } });
    });
    const r = await importarColeccion("t".repeat(30), COL, f as unknown as typeof fetch);
    expect(r.filas.map((x) => x.category)).toEqual(["Arquitectura", "zz"]);
  });

  it("explica token inválido o sin permisos", async () => {
    await expect(listarColecciones("t".repeat(30), vi.fn(async () => new Response("", { status: 401 })) as unknown as typeof fetch)).rejects.toThrow(/rechazó el token/);
    await expect(listarColecciones("t".repeat(30), vi.fn(async () => new Response("", { status: 403 })) as unknown as typeof fetch)).rejects.toThrow(/cms:read/);
    expect(() => validarToken("corto")).toThrow();
    await expect(importarColeccion("t".repeat(30), "../../etc")).rejects.toThrow(/inválido/);
  });
});
