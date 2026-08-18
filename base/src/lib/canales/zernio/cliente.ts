import { entorno } from "@/lib/entorno";
import type { Resultado } from "../tipos";

/**
 * Cliente HTTP con fetch nativo, sin SDK. Se usan ocho endpoints: un SDK agregaría
 * superficie de dependencia y acoplamiento de versión a cambio de nada.
 *
 * NUNCA tira excepción: un canal caído no puede voltear el request entero.
 */
export async function pedir<T>(
  ruta: string,
  opts: {
    metodo?: "GET" | "POST" | "PUT" | "DELETE";
    query?: Record<string, string | number | undefined>;
    cuerpo?: unknown;
    timeoutMs?: number;
  } = {},
): Promise<Resultado<T>> {
  const { metodo = "GET", query, cuerpo, timeoutMs = 15_000 } = opts;

  const url = new URL(`${entorno.ZERNIO_API_URL}${ruta}`);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  const corte = AbortSignal.timeout(timeoutMs);

  try {
    const res = await fetch(url, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${entorno.ZERNIO_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: corte,
      cache: "no-store",
    });

    const texto = await res.text();

    if (!res.ok) {
      return {
        ok: false,
        estado: res.status,
        error: `${metodo} ${ruta} → ${res.status}: ${texto.slice(0, 300)}`,
      };
    }

    if (!texto) return { ok: true, data: undefined as T };

    try {
      return { ok: true, data: JSON.parse(texto) as T };
    } catch {
      return { ok: false, estado: res.status, error: `Respuesta no es JSON: ${texto.slice(0, 200)}` };
    }
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `${metodo} ${ruta} falló: ${motivo}` };
  }
}
