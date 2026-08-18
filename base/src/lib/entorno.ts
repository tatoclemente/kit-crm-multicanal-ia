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

export const entorno = esquema.parse(process.env);
export type Entorno = z.infer<typeof esquema>;

/** El host real, sacado del request. Nunca de una variable de entorno. */
export function urlBase(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}
