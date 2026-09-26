import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cifrar, descifrar } from "@/lib/server/cifrado";
import { cifrarDestinos, enviar, htmlDeResumen, type Paquete } from "@/lib/server/envios";

const paquete: Paquete = { asunto: "Mantenimiento — 25/9", resumen: "El costo fue **$52M**.\n\n- Córdoba lidera\n- <script>x</script>", link: "https://app.test/reportes/1" };
const WEBHOOK = "https://hooks.slack.com/services/T000/B000/secretito123";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("enviar", () => {
  it("Slack: postea mrkdwn con el link al webhook", async () => {
    const f = vi.fn(async () => new Response("ok"));
    await enviar({ canal: "slack", direccion: WEBHOOK }, paquete, f as unknown as typeof fetch);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(WEBHOOK);
    const body = JSON.parse(init.body as string);
    expect(body.text).toContain("*$52M*");
    expect(body.text).toContain("<https://app.test/reportes/1|Abrir en Insight>");
  });

  it("Slack: explica un webhook revocado", async () => {
    const f = vi.fn(async () => new Response("no", { status: 404 }));
    await expect(enviar({ canal: "slack", direccion: WEBHOOK }, paquete, f as unknown as typeof fetch)).rejects.toThrow(/revocado/);
  });

  it("Email: sin proveedor configurado falla con un mensaje claro", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("SELENE_HUB_URL", "");
    vi.stubEnv("SELENE_HUB_API_KEY", "");
    await expect(enviar({ canal: "email", direccion: "a@b.com" }, paquete)).rejects.toThrow(/no está configurado/);
  });

  it("Email: sin Resend usa Selene Hub /sendEmail con x-api-key y multipart", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("SELENE_HUB_URL", "https://hub.test/api/");
    vi.stubEnv("SELENE_HUB_API_KEY", "sk_test");
    const f = vi.fn(async () => new Response("{}"));
    await enviar({ canal: "email", direccion: "a@b.com" }, paquete, f as unknown as typeof fetch);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hub.test/api/sendEmail");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("sk_test");
    const data = JSON.parse((init.body as FormData).get("data") as string);
    expect(data).toMatchObject({ email: "a@b.com", subject: paquete.asunto });
    expect(data.html).toContain("<strong>$52M</strong>");
  });

  it("Email: propaga el error del Hub", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("SELENE_HUB_URL", "https://hub.test");
    vi.stubEnv("SELENE_HUB_API_KEY", "sk_test");
    const f = vi.fn(async () => Response.json({ error: "Destinatario inválido" }, { status: 400 }));
    await expect(enviar({ canal: "email", direccion: "a@b.com" }, paquete, f as unknown as typeof fetch)).rejects.toThrow(/Destinatario inválido/);
  });

  it("Email: llama a Resend con HTML y texto", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const f = vi.fn(async () => new Response("{}"));
    await enviar({ canal: "email", direccion: "a@b.com" }, paquete, f as unknown as typeof fetch);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body as string)).toMatchObject({ to: ["a@b.com"], subject: paquete.asunto });
  });
});

describe("htmlDeResumen", () => {
  it("escapa el texto del modelo y arma lista y negrita", () => {
    const html = htmlDeResumen(paquete);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("<strong>$52M</strong>");
    expect(html).toContain("<li>Córdoba lidera</li>");
  });
});

describe("cifrarDestinos", () => {
  it("guarda el webhook cifrado y expone solo la versión enmascarada", async () => {
    vi.stubEnv("FUENTES_SECRET", "secreto-de-test-suficientemente-largo");
    const r = await cifrarDestinos([{ canal: "slack", direccion: WEBHOOK }, { canal: "email", direccion: "equipo@empresa.com" }]);
    expect(JSON.stringify(r.destinos_publicos)).not.toContain("secretito");
    expect(r.destinos_publicos[1]).toEqual({ canal: "email", direccion: "equipo@empresa.com" });
    expect(JSON.parse(await descifrar(r.destinos_cifrados))[0].direccion).toBe(WEBHOOK);
    expect(await cifrar("x")).toMatch(/^v1\./);
  });
});

describe("endpoint de cron", () => {
  it("rechaza pedidos sin el secreto correcto", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secreto-de-prueba-123");
    const { GET } = await import("@/app/api/cron/reportes/route");
    const sin = await GET(new NextRequest("https://app.test/api/cron/reportes"));
    const mal = await GET(new NextRequest("https://app.test/api/cron/reportes", { headers: { authorization: "Bearer otro-secreto-de-prueba-12" } }));
    expect(sin.status).toBe(401);
    expect(mal.status).toBe(401);
  });

  it("sin CRON_SECRET configurado no se puede disparar", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const { GET } = await import("@/app/api/cron/reportes/route");
    const r = await GET(new NextRequest("https://app.test/api/cron/reportes", { headers: { authorization: "Bearer " } }));
    expect(r.status).toBe(401);
  });
});
