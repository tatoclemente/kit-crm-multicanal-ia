import { z } from "zod";

/**
 * Validación de entorno. Falla al arrancar, no en el primer mensaje.
 *
 * APP_BASE_URL no está acá a propósito: en producción el host sale del request.
 * Una URL fija mal puesta hace que el agente no conteste nunca, sin un solo error.
 */
const esquema = z.object({
  DATABASE_URL: z.string().url(),

  ZERNIO_API_KEY: z.string().min(10),
  ZERNIO_API_URL: z.string().url().default("https://zernio.com/api"),
  /** Sin secreto el webhook rechaza todo. Fail-closed, nunca fail-open. */
  ZERNIO_WEBHOOK_SECRET: z.string().min(16),

  OPENROUTER_API_KEY: z.string().min(10),
  /** Modelo por defecto. Se puede pisar por canal en agent_configs. */
  OPENROUTER_MODEL: z.string().default("anthropic/claude-haiku-4.5"),

  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  /** Solo del lado del servidor. Nunca en un componente cliente ni en un NEXT_PUBLIC_. */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),

  /** Protege los barridos de recuperación. */
  CRON_SECRET: z.string().min(16),

  LOG_LEVEL: z.enum(["silent", "error", "warn", "info", "debug"]).default("info"),
});

/**
 * Falla al arrancar con un mensaje que se entiende, no con un volcado de zod.
 * La diferencia importa: "falta ZERNIO_API_KEY" se arregla en diez segundos;
 * un error de validación crudo parece que las credenciales estuvieran mal.
 */
function leerEntorno(): Entorno {
  const resultado = esquema.safeParse(process.env);
  if (resultado.success) return resultado.data;

  const faltantes = Object.entries(resultado.error.flatten().fieldErrors)
    .map(([variable, errores]) => `  - ${variable}: ${errores?.[0] ?? "inválida"}`)
    .join("\n");

  throw new Error(
    `Faltan variables de entorno o son inválidas:\n${faltantes}\n\n` +
      `Copiá base/.env.example a base/.env.local y completalas.\n` +
      `Ese archivo está en .gitignore: no viaja al repositorio.\n` +
      `En producción van en el panel de Vercel, no en un archivo.`,
  );
}

export type Entorno = z.infer<typeof esquema>;
export const entorno = leerEntorno();

/** El host real, sacado del request. Nunca de una variable de entorno. */
export function urlBase(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}
