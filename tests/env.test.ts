import { afterEach, describe, expect, it, vi } from "vitest";
import { redirigir, urlPublica } from "@/lib/env";

afterEach(() => vi.unstubAllEnvs());

describe("urlPublica", () => {
  it("prioriza NEXT_PUBLIC_SITE_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://insight.app/");
    expect(urlPublica("https://otro.com")).toBe("https://insight.app");
  });
  it("usa el origin del navegador, pero nunca el host interno de Webflow", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(urlPublica("http://localhost:3100")).toBe("http://localhost:3100");
    expect(urlPublica("https://36f7.wf-app-prod.cosmic.webflow.services")).toBe("https://webflow-eeebd5.webflow.io");
    expect(urlPublica(null)).toBe("https://webflow-eeebd5.webflow.io");
  });
});

describe("redirigir", () => {
  it("devuelve un Location relativo que el navegador resuelve contra la URL pública", () => {
    const r = redirigir("/login", 303);
    expect(r.status).toBe(303);
    expect(r.headers.get("Location")).toBe("/login");
  });
});
