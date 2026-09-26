import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Webflow Cloud reenvía los pedidos con `x-forwarded-host` apuntando a su dominio interno
      // (*.cosmic.webflow.services), distinto del `origin` público: sin esto Next aborta toda
      // Server Action por protección CSRF. Se permiten solo dominios de Webflow y el local.
      allowedOrigins: ["*.webflow.io", "*.cosmic.webflow.services", "localhost:3000", "localhost:3100"],
    },
  },
};

export default nextConfig;
