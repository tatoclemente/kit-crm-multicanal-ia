import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El grafo del agente se importa dinámicamente adentro de after(): no lo empaquetes
  // en el arranque de la ruta del webhook.
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
