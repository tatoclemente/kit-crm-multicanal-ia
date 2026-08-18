import { and, desc, eq } from "drizzle-orm";
import { db, esquema } from "@/lib/db";
import { entorno } from "@/lib/entorno";
import { entregarMensaje } from "@/lib/mensajeria/entregar";
import { elAgentePuedeResponder, estadoDeVentana } from "@/lib/mensajeria/ventana";
import { herramientasHabilitadas } from "./herramientas";
import type { ContextoHerramienta } from "./herramientas";
import { revisarSaliente } from "./guardrails";
import { humanizar } from "./humanizar";
import { armarPrompt } from "./prompt";
import { pedirRespuesta, type HerramientaChat, type MensajeChat } from "./llm";

/** Un evento que quedó encolado y se procesa mucho después no se contesta. */
const ANTIGUEDAD_MAXIMA_MS = 15 * 60 * 1000;
const MAX_VUELTAS_DE_HERRAMIENTAS = 4;
const MENSAJES_DE_HISTORIAL = 30;

/**
 * Ejecuta el agente para UNA conversación.
 *
 * El historial se filtra por ESA conversación, nunca por contacto: si no, el agente
 * mezcla lo que la persona dijo por Instagram con lo que dijo por WhatsApp.
 */
export async function responderConversacion(opts: {
  conversationId: string;
  eventoGeneradoEn?: Date;
}): Promise<{ respondio: boolean; motivo?: string }> {
  const { conversationId } = opts;

  // 1 · Mensajes viejos: no le contestes a alguien como si acabara de escribir.
  if (opts.eventoGeneradoEn && !Number.isNaN(opts.eventoGeneradoEn.getTime())) {
    const antiguedad = Date.now() - opts.eventoGeneradoEn.getTime();
    if (antiguedad > ANTIGUEDAD_MAXIMA_MS) {
      return { respondio: false, motivo: "evento vencido" };
    }
  }

  const conv = await db.query.conversations.findFirst({
    where: eq(esquema.conversations.id, conversationId),
  });
  if (!conv) return { respondio: false, motivo: "conversación inexistente" };

  // 2 · Doble interruptor. Los dos tienen que estar prendidos.
  if (!conv.aiEnabled) return { respondio: false, motivo: "IA apagada en este hilo" };

  const config = await configDelCanal(conv.channel);
  if (!config.enabled) return { respondio: false, motivo: `canal ${conv.channel} apagado` };

  // 3 · Ventana de 24 horas. El agente nunca escribe fuera de ventana.
  if (!elAgentePuedeResponder(estadoDeVentana(conv.channel, conv.lastInboundAt))) {
    return { respondio: false, motivo: "fuera de la ventana de 24 horas" };
  }

  // 4 · Agrupación: espera por si la persona sigue escribiendo, y si llegó algo más
  //     nuevo se retira. El trabajo del mensaje siguiente es el que va a contestar.
  const ultimoAlEmpezar = await ultimoEntrante(conversationId);
  if (config.bufferSeconds > 0) {
    await esperar(config.bufferSeconds * 1000);
    const ultimoAhora = await ultimoEntrante(conversationId);
    if (ultimoAhora && ultimoAlEmpezar && ultimoAhora.id !== ultimoAlEmpezar.id) {
      return { respondio: false, motivo: "llegó un mensaje más nuevo" };
    }
  }

  // 5 · Historial de ESTA conversación.
  const historial = await db
    .select()
    .from(esquema.messages)
    .where(eq(esquema.messages.conversationId, conversationId))
    .orderBy(desc(esquema.messages.sentAt))
    .limit(MENSAJES_DE_HISTORIAL);

  const contacto = conv.contactId
    ? await db.query.contacts.findFirst({ where: eq(esquema.contacts.id, conv.contactId) })
    : null;

  const sistema = armarPrompt({
    instruccionesDelNegocio: config.systemPrompt,
    canario: process.env.CODIGO_CANARIO,
    contexto: {
      nombre: conv.participantName,
      telefono: contacto?.phone ?? null,
      canal: conv.channel,
      fichaPrevia: contacto?.fields ?? null,
      esClienteConocido: Boolean(contacto?.externalSystemId),
    },
  });

  const mensajes: MensajeChat[] = [
    { role: "system", content: sistema },
    ...historial
      .slice()
      .reverse()
      .map<MensajeChat>((m) => ({
        role: m.direction === "inbound" ? "user" : "assistant",
        content: m.body ?? (m.attachments?.length ? "[adjunto]" : ""),
      }))
      .filter((m) => typeof m.content === "string" && m.content.length > 0),
  ];

  const herramientas = herramientasHabilitadas(config.enabledTools);
  const definiciones: HerramientaChat[] = herramientas.map((h) => ({
    type: "function",
    function: { name: h.nombre, description: h.descripcion, parameters: h.parametros },
  }));

  const ctx: ContextoHerramienta = {
    conversationId,
    contactId: conv.contactId,
    channel: conv.channel,
    telefono: contacto?.phone ?? null,
  };

  // 6 · Vuelta de herramientas.
  let texto: string | null = null;
  for (let vuelta = 0; vuelta < MAX_VUELTAS_DE_HERRAMIENTAS; vuelta++) {
    const res = await pedirRespuesta({
      modelo: config.model ?? entorno.OPENROUTER_MODEL,
      mensajes,
      herramientas: definiciones,
    });

    if (!res.ok) {
      console.error("[agente] el modelo falló:", res.error);
      return { respondio: false, motivo: `modelo: ${res.error}` };
    }

    if (res.data.llamadas.length === 0) {
      texto = res.data.texto;
      break;
    }

    if (res.data.mensajeCrudo) mensajes.push(res.data.mensajeCrudo as MensajeChat);

    for (const llamada of res.data.llamadas) {
      const herramienta = herramientas.find((h) => h.nombre === llamada.nombre);
      let salida: string;
      if (!herramienta) {
        salida = `La herramienta ${llamada.nombre} no está disponible.`;
      } else {
        try {
          const args = JSON.parse(llamada.argumentos || "{}") as Record<string, unknown>;
          salida = await herramienta.ejecutar(args, ctx);
        } catch (e) {
          salida = `No se pudo ejecutar: ${e instanceof Error ? e.message : String(e)}`;
        }
      }
      mensajes.push({ role: "tool", tool_call_id: llamada.id, content: salida });
    }
  }

  // Si se quedó sin texto después de usar herramientas, forzamos un cierre.
  if (!texto?.trim()) {
    const cierre = await pedirRespuesta({
      modelo: config.model ?? entorno.OPENROUTER_MODEL,
      mensajes: [...mensajes, { role: "user", content: "Respondele a la persona con lo que sabés ahora." }],
      herramientas: [],
    });
    texto = cierre.ok ? cierre.data.texto : null;
  }

  if (!texto?.trim()) return { respondio: false, motivo: "el modelo no devolvió texto" };

  // 7 · Guardrails ANTES de que salga.
  const revisado = await revisarSaliente(
    texto,
    {
      preciosPermitidos: config.allowedPrices,
      hostsPermitidos: config.allowedHosts,
      canario: process.env.CODIGO_CANARIO,
      mensajeFallback: config.fallbackMessage ?? "",
    },
    { conversationId },
  );

  const aEnviar = revisado.permitido ? revisado.texto : revisado.textoSeguro;
  if (!revisado.permitido) {
    console.warn(`[guardrail] ${revisado.regla}: ${revisado.detalle}`);
  }

  // 8 · Salida por el único camino que existe.
  for (const parte of humanizar(aEnviar)) {
    const envio = await entregarMensaje({ conversationId, texto: parte, autor: "agent" });
    if (!envio.ok) return { respondio: false, motivo: envio.motivo };
  }

  return { respondio: true };
}

/**
 * Cascada: config del canal → config global → default del código.
 *
 * El `??` solo funciona porque las columnas de `agentConfigs` que cascadean son
 * NULLABLE sin default en el esquema (ver el comentario en `db/esquema.ts`). Si
 * alguna volviera a tener `.notNull().default(...)`, una fila de canal sin ese campo
 * dejaría de ser `null` y pasaría a ser el default de la columna: el `??` dejaría de
 * caer al valor global, y las herramientas o la lista blanca de precios quedarían
 * vacías sin ningún error que lo avise.
 */
async function configDelCanal(canal: string) {
  const filas = await db.query.agentConfigs.findMany();
  const delCanal = filas.find((f) => f.channel === canal);
  const global = filas.find((f) => f.channel === "global");

  return {
    // Si el canal no tiene fila, arranca APAGADO. Nunca hereda `enabled` del global.
    enabled: delCanal?.enabled ?? false,
    systemPrompt: delCanal?.systemPrompt ?? global?.systemPrompt ?? null,
    enabledTools: delCanal?.enabledTools ?? global?.enabledTools ?? [],
    model: delCanal?.model ?? global?.model ?? null,
    bufferSeconds: delCanal?.bufferSeconds ?? global?.bufferSeconds ?? 8,
    allowedPrices: delCanal?.allowedPrices ?? global?.allowedPrices ?? [],
    allowedHosts: delCanal?.allowedHosts ?? global?.allowedHosts ?? [],
    fallbackMessage: delCanal?.fallbackMessage ?? global?.fallbackMessage ?? null,
  };
}

async function ultimoEntrante(conversationId: string) {
  return db.query.messages.findFirst({
    where: and(
      eq(esquema.messages.conversationId, conversationId),
      eq(esquema.messages.direction, "inbound"),
    ),
    orderBy: desc(esquema.messages.sentAt),
  });
}

function esperar(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
