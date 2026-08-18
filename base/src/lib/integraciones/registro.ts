import { db, esquema } from "@/lib/db";
import type { RespuestaSistema, SistemaExterno } from "./tipos";
import { sistemaEjemplo } from "./ejemplo-tienda-servicio/adaptador";

/**
 * Acá se elige el sistema externo. Por defecto está el de ejemplo (ficticio, offline),
 * para que el kit funcione y se pueda probar sin credenciales de nadie.
 *
 * Para conectar el sistema real: escribí tu adaptador en
 * `src/lib/integraciones/<tu-sistema>/adaptador.ts`, importalo acá y ponelo en el mapa.
 */
const sistemas: Record<string, SistemaExterno> = {
  ejemplo: sistemaEjemplo,
};

export function sistemaExterno(): SistemaExterno | null {
  const elegido = process.env.SISTEMA_EXTERNO ?? "ejemplo";
  return sistemas[elegido] ?? null;
}

/**
 * Envoltorio con registro y tiempo de corte. Toda llamada al sistema del cliente pasa
 * por acá: cuando algo falla, `integration_calls` es lo primero que se mira.
 */
export async function llamarSistema<T>(
  operacion: string,
  fn: () => Promise<RespuestaSistema<T>>,
  ctx: { conversationId?: string; timeoutMs?: number } = {},
): Promise<RespuestaSistema<T>> {
  const sistema = sistemaExterno();
  const arranque = Date.now();
  const corte = ctx.timeoutMs ?? 8000;

  const vencimiento = new Promise<RespuestaSistema<T>>((resolver) =>
    setTimeout(
      () => resolver({ ok: false, error: `El sistema externo no respondió en ${corte} ms` }),
      corte,
    ),
  );

  let resultado: RespuestaSistema<T>;
  try {
    resultado = await Promise.race([fn(), vencimiento]);
  } catch (e) {
    resultado = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  await db
    .insert(esquema.integrationCalls)
    .values({
      system: sistema?.nombre ?? "desconocido",
      operation: operacion,
      conversationId: ctx.conversationId ?? null,
      ok: resultado.ok,
      durationMs: Date.now() - arranque,
      detail: resultado.ok ? null : resultado.error.slice(0, 500),
    })
    .catch(() => undefined);

  return resultado;
}
