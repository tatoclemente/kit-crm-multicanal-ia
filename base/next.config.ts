import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next genera su propio AGENTS.md y CLAUDE.md dentro de esta carpeta. Acá sobran y
  // confunden: la fuente canónica del kit es el AGENTS.md de la raíz, no este.
  agentRules: false,
  // El grafo del agente se importa dinámicamente adentro de after(): no lo empaquetes
  // en el arranque de la ruta del webhook.
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
