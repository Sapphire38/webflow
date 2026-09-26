import { describe, expect, it } from "vitest";
import { destinoSeguro, urlDeCallback } from "@/lib/auth/redirect";

describe("destinoSeguro", () => {
  it("acepta rutas internas", () => {
    expect(destinoSeguro("/dashboards/1")).toBe("/dashboards/1");
  });
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "", null, undefined, "chat"])(
    "rechaza %s",
    (n) => {
      expect(destinoSeguro(n as string)).toBe("/chat");
    },
  );
});

describe("urlDeCallback", () => {
  it("incluye el mount path y el destino", () => {
    expect(urlDeCallback("https://x.webflow.io", "/app", "/reset-password")).toBe(
      "https://x.webflow.io/app/auth/callback?next=%2Freset-password",
    );
  });
  it("funciona en la raíz y sanea el next", () => {
    expect(urlDeCallback("http://localhost:3000", "", "https://evil.com")).toBe(
      "http://localhost:3000/auth/callback?next=%2Fchat",
    );
  });
});
