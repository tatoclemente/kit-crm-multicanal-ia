import { db, esquema } from "@/lib/db";

/**
 * Capa que se aplica a TODA respuesta antes de que salga. No es paranoia: un modelo que
 * no tiene el precio a mano lo estima, el cliente lee "sale 45.000" y el negocio queda
 * atado a un número que nadie autorizó.
 */
export interface ConfigGuardrails {
  /** Cifras de dinero que el agente PUEDE decir. Incluí también las derivadas. */
  preciosPermitidos: string[];
  /** Dominios que el agente PUEDE enlazar. Los del negocio. */
  hostsPermitidos: string[];
  /** Cadena secreta: si aparece en una respuesta, el modelo está filtrando su prompt. */
  canario?: string;
  mensajeFallback: string;
}

export type ResultadoGuardrail =
  | { permitido: true; texto: string }
  | { permitido: false; regla: string; detalle: string; textoSeguro: string };

const FALLBACK_POR_DEFECTO =
  "Dejame confirmar ese dato con el equipo y te respondo en un rato.";

/**
 * Fechas que hay que sacar del texto ANTES de buscar cifras de dinero: DD/MM,
 * DD/MM/AAAA y AAAA-MM-DD. Sin esto, "el 11/08/2026" deja el año "2026" suelto, con
 * cuatro dígitos: pasa el filtro de longitud mínima y se lee como un precio.
 */
const REGEX_FECHA = /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}\b/g;

/** Cifra con formato de dinero completa: dígitos con separadores de miles o decimales. */
const REGEX_CIFRA = /\d(?:[\d.,]*\d)?/g;

/**
 * Extrae cifras de dinero de un texto, evitando dos falsos positivos reales que
 * aparecieron probando el kit contra la API real — los dos silenciosos, sin un solo
 * error en ningún lado:
 *
 * 1. Números de pedido o de reparación ("PED-4471", "REP-2201"): la cifra queda
 *    pegada a un prefijo con letras y guion. Una respuesta perfecta ("tu pedido
 *    PED-4471 está en camino") se bloqueaba porque "447" parecía una cifra suelta.
 * 2. Cantidades con unidad pegada ("40L", "1200ml"): sin espacio antes de la letra,
 *    el número se lee igual que un precio.
 *
 * La exclusión se hace en dos pasos, no en una sola regex con lookaround: un
 * lookahead al final de una regex con grupo opcional deja que el motor RETROCEDA a
 * un match más corto para esquivar la condición (probado: "40L" con un lookahead
 * `(?!\p{L})` al final igual dejaba pasar "4" solo, porque "0" —el siguiente
 * carácter tras acortar el match— no es una letra). Achicar la cifra completa
 * primero con `matchAll` y revisar el carácter de antes y de después en JS evita
 * ese retroceso: siempre se juzga el número entero, nunca un fragmento.
 */
function extraerCifras(texto: string): string[] {
  const sinFechas = texto.replace(REGEX_FECHA, " ");
  const resultado: string[] = [];
  for (const m of sinFechas.matchAll(REGEX_CIFRA)) {
    const inicio = m.index;
    const fin = inicio + m[0].length;
    const antes = sinFechas[inicio - 1];
    const despues = sinFechas[fin];
    // Pegado a una letra, otro dígito, punto, coma o guion: es parte de un código.
    if (antes && /[\p{L}\d.,-]/u.test(antes)) continue;
    // Pegado a una letra sin espacio: es una cantidad con unidad, no un precio.
    if (despues && /\p{L}/u.test(despues)) continue;
    resultado.push(m[0]);
  }
  return resultado;
}

/** Entrada: lo que manda la persona. Corta el abuso antes de gastar tokens. */
export function revisarEntrante(
  texto: string,
  opts: { maximo?: number } = {},
): { texto: string; truncado: boolean } {
  const maximo = opts.maximo ?? 4000;
  if (texto.length <= maximo) return { texto, truncado: false };
  return { texto: texto.slice(0, maximo), truncado: true };
}

/** Salida: lo que el agente quiere decir. Acá se bloquea de verdad. */
export async function revisarSaliente(
  texto: string,
  config: ConfigGuardrails,
  ctx: { conversationId: string },
): Promise<ResultadoGuardrail> {
  const fallback = config.mensajeFallback || FALLBACK_POR_DEFECTO;

  // 1 · Fuga del prompt. Si el canario aparece, el modelo está recitando instrucciones.
  if (config.canario && texto.includes(config.canario)) {
    return await bloquear("fuga-de-prompt", "Apareció el código canario en la respuesta");
  }

  // 2 · Precios inventados.
  const cifras = extraerCifras(texto);
  const permitidas = new Set(config.preciosPermitidos.map(normalizarCifra));
  for (const cifra of cifras) {
    const limpia = normalizarCifra(cifra);
    if (!limpia || limpia.length < 3) continue; // ignoramos números chicos: horas, cantidades
    if (permitidas.size > 0 && !permitidas.has(limpia)) {
      return await bloquear("precio-no-autorizado", `Cifra fuera de la lista: ${cifra.trim()}`);
    }
  }

  // 3 · Enlaces a dominios que no son del negocio.
  const urls = texto.match(/https?:\/\/[^\s<>")]+/gi) ?? [];
  for (const cruda of urls) {
    let host: string;
    try {
      host = new URL(cruda).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return await bloquear("enlace-ilegible", `No se pudo interpretar la URL: ${cruda}`);
    }
    const permitido =
      host === "wa.me" ||
      config.hostsPermitidos.some((h) => {
        const limpio = h.trim().toLowerCase().replace(/^www\./, "");
        return limpio !== "" && (host === limpio || host.endsWith(`.${limpio}`));
      });
    if (!permitido) {
      return await bloquear("enlace-no-autorizado", `Dominio fuera de la lista: ${host}`);
    }
  }

  return { permitido: true, texto };

  async function bloquear(regla: string, detalle: string): Promise<ResultadoGuardrail> {
    await db.insert(esquema.guardrailEvents).values({
      conversationId: ctx.conversationId,
      rule: regla,
      detail: detalle,
      blockedText: texto.slice(0, 2000),
    });
    return { permitido: false, regla, detalle, textoSeguro: fallback };
  }
}

/** "$45.000" y "45000" son la misma cifra. Comparamos solo los dígitos. */
function normalizarCifra(valor: string): string {
  return valor.replace(/[^\d]/g, "");
}
