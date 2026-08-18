import { eq } from "drizzle-orm";
import { db, esquema } from "@/lib/db";
import { proveedor } from "@/lib/canales/registro";
import { estadoDeVentana } from "./ventana";
import { emitirEvento } from "@/lib/integraciones/salientes";

/**
 * UN SOLO CAMINO DE SALIDA.
 *
 * Todo mensaje que sale del CRM pasa por acá: el agente, la interfaz, la API pública y
 * el servidor MCP. Envía Y persiste, en ese orden y en un solo lugar.
 *
 * Si cada lugar inserta por su cuenta, se desincronizan y aparecen mensajes enviados
 * que no figuran en el historial, o al revés. Funcionan los dos caminos hasta que dejan
 * de coincidir, y para entonces nadie sabe cuál tiene razón.
 */
export interface PedidoDeEntrega {
  conversationId: string;
  texto: string;
  autor: "agent" | "human" | "system";
  usuarioId?: string;
  adjuntoUrl?: string;
  /** Solo una persona puede forzar un envío fuera de ventana. El agente nunca. */
  forzarFueraDeVentana?: boolean;
}

export type ResultadoEntrega =
  | { ok: true; messageId: string; externalId: string | null }
  | { ok: false; motivo: string; codigo: "sin-conversacion" | "fuera-de-ventana" | "proveedor" };

export async function entregarMensaje(pedido: PedidoDeEntrega): Promise<ResultadoEntrega> {
  const conv = await db.query.conversations.findFirst({
    where: eq(esquema.conversations.id, pedido.conversationId),
  });
  if (!conv) return { ok: false, motivo: "La conversación no existe", codigo: "sin-conversacion" };

  const cuenta = await db.query.channelAccounts.findFirst({
    where: eq(esquema.channelAccounts.id, conv.accountId),
  });
  if (!cuenta) {
    return { ok: false, motivo: "La conversación no tiene cuenta conectada", codigo: "sin-conversacion" };
  }

  const ventana = estadoDeVentana(conv.channel, conv.lastInboundAt);
  if (!ventana.abierta && pedido.autor === "agent") {
    return { ok: false, motivo: ventana.motivo, codigo: "fuera-de-ventana" };
  }
  if (!ventana.abierta && !pedido.forzarFueraDeVentana) {
    return { ok: false, motivo: ventana.motivo, codigo: "fuera-de-ventana" };
  }

  // 1 · Fila optimista en estado pendiente, para que la interfaz muestre algo ya.
  const [fila] = await db
    .insert(esquema.messages)
    .values({
      conversationId: conv.id,
      channel: conv.channel,
      provider: conv.provider,
      direction: "outbound",
      body: pedido.texto,
      author: pedido.autor,
      authorUserId: pedido.usuarioId ?? null,
      status: "pending",
      attachments: pedido.adjuntoUrl ? [{ type: "file", url: pedido.adjuntoUrl }] : null,
    })
    .returning();

  if (!fila) return { ok: false, motivo: "No se pudo persistir el mensaje", codigo: "proveedor" };

  // 2 · Envío real.
  const envio = await proveedor(conv.provider).enviarMensaje({
    conversationExternalId: conv.externalId,
    accountExternalId: cuenta.externalId,
    text: pedido.texto,
    attachmentUrl: pedido.adjuntoUrl,
    fueraDeVentana: !ventana.abierta,
  });

  if (!envio.ok) {
    await db
      .update(esquema.messages)
      .set({ status: "failed", error: envio.error.slice(0, 500) })
      .where(eq(esquema.messages.id, fila.id));
    return { ok: false, motivo: envio.error, codigo: "proveedor" };
  }

  // 3 · Confirmación y actualización del hilo.
  await db
    .update(esquema.messages)
    .set({ status: "sent", externalId: envio.data.externalId })
    .where(eq(esquema.messages.id, fila.id));

  await db
    .update(esquema.conversations)
    .set({ lastMessageAt: new Date() })
    .where(eq(esquema.conversations.id, conv.id));

  // 4 · Aviso a los sistemas de afuera. Nunca bloquea la entrega.
  void emitirEvento("message.outbound", {
    conversationId: conv.id,
    channel: conv.channel,
    author: pedido.autor,
    text: pedido.texto,
  });

  return { ok: true, messageId: fila.id, externalId: envio.data.externalId };
}
