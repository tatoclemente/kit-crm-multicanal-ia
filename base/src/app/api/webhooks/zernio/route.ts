import { after } from "next/server";
import { and, eq, isNull, lt } from "drizzle-orm";
import { db, esquema } from "@/lib/db";
import { entorno } from "@/lib/entorno";
import { HEADER_FIRMA, verificarFirma } from "@/lib/canales/zernio/webhooks";
import { mensajeDesdeWebhook } from "@/lib/canales/zernio/mapeo";
import { registrarEntrante } from "@/lib/mensajeria/ingreso";
import type {
  EventoZernio,
  WebhookCuentaConectada,
  WebhookEstadoEntrega,
  WebhookMensajeRecibido,
} from "@/lib/canales/zernio/tipos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook entrante. El orden de los pasos NO es decorativo: reclamar el evento antes
 * de procesarlo es lo que evita que dos reintentos simultáneos contesten dos veces.
 *
 * Presupuesto: 5 segundos para devolver 2xx. Persistimos inline (es un INSERT) y el
 * trabajo pesado va después de responder, adentro de after().
 */
export async function POST(req: Request): Promise<Response> {
  // 1 · Body CRUDO y firma. Si parseás el JSON y lo volvés a serializar, la firma
  //     nunca valida.
  const bodyCrudo = await req.text();
  if (!verificarFirma(bodyCrudo, req.headers.get(HEADER_FIRMA))) {
    return new Response("firma inválida", { status: 401 });
  }

  let evento: EventoZernio;
  try {
    evento = JSON.parse(bodyCrudo) as EventoZernio;
  } catch {
    // Body ilegible con firma válida es un problema del proveedor, no nuestro.
    // 200 igual: diez respuestas de error seguidas apagan la suscripción.
    return Response.json({ ok: true, ignorado: "body ilegible" });
  }

  if (!evento?.id || !evento?.event) {
    return Response.json({ ok: true, ignorado: "evento sin id" });
  }

  // 2 · Reclamar el evento. Si no insertó, es un reintento: 200 y cortamos.
  const [reclamado] = await db
    .insert(esquema.webhookEvents)
    .values({ eventId: evento.id, event: evento.event, payload: evento as Record<string, unknown> })
    .onConflictDoNothing()
    .returning();

  if (!reclamado) return Response.json({ ok: true, reintento: true });

  // 3 · Procesar según el tipo. Lo que no conocemos: se registra y se responde 200.
  try {
    switch (evento.event) {
      case "message.received": {
        const resultado = await recibirMensaje(evento as WebhookMensajeRecibido);
        if (resultado?.esNuevo) {
          // 4 · El agente va DESPUÉS de responder, con import dinámico adentro del
          //     after(). Arriba del archivo, el arranque en frío se come los 5 segundos.
          const conversationId = resultado.conversationId;
          const generadoEn = new Date(evento.timestamp);
          after(async () => {
            const { responderConversacion } = await import("@/lib/agente/ejecutar");
            await responderConversacion({ conversationId, eventoGeneradoEn: generadoEn });
            await marcarProcesado(evento.id);
          });
          return Response.json({ ok: true });
        }
        break;
      }

      case "message.delivered":
      case "message.read":
      case "message.failed":
        await actualizarEstado(evento as WebhookEstadoEntrega);
        break;

      case "account.connected":
      case "account.disconnected":
        await actualizarCuenta(evento as WebhookCuentaConectada);
        break;

      case "conversation.started":
      case "referral.received":
      case "message.sent":
      case "webhook.test":
        // Nada que hacer todavía; queda el payload guardado para auditoría.
        break;

      default:
        console.info(`[webhook] evento no manejado: ${evento.event}`);
    }

    await marcarProcesado(evento.id);
    return Response.json({ ok: true });
  } catch (e) {
    const motivo = e instanceof Error ? e.message : String(e);
    console.error(`[webhook] ${evento.event} falló:`, motivo);
    await db
      .update(esquema.webhookEvents)
      .set({ error: motivo.slice(0, 500) })
      .where(eq(esquema.webhookEvents.eventId, evento.id));
    // 200 a propósito: el barrido de recuperación lo levanta después.
    return Response.json({ ok: true, diferido: true });
  }
}

/**
 * Red de seguridad: eventos reclamados pero sin procesar, para cuando el trabajo en
 * segundo plano muere a mitad de camino. Lo llama el barrido cada 30 minutos.
 */
export async function GET(req: Request): Promise<Response> {
  if (!autorizado(req)) return new Response("no autorizado", { status: 401 });

  const hace5min = new Date(Date.now() - 5 * 60 * 1000);
  const pendientes = await db
    .select({
      eventId: esquema.webhookEvents.eventId,
      event: esquema.webhookEvents.event,
      receivedAt: esquema.webhookEvents.receivedAt,
      error: esquema.webhookEvents.error,
    })
    .from(esquema.webhookEvents)
    .where(
      and(
        isNull(esquema.webhookEvents.processedAt),
        lt(esquema.webhookEvents.receivedAt, hace5min),
      ),
    )
    .limit(100);

  return Response.json({ pendientes: pendientes.length, eventos: pendientes });
}

function autorizado(req: Request): boolean {
  const cabecera = req.headers.get("authorization");
  const propia = req.headers.get("x-cron-secret");
  return (
    cabecera === `Bearer ${entorno.CRON_SECRET}` || propia === entorno.CRON_SECRET
  );
}

async function marcarProcesado(eventId: string): Promise<void> {
  await db
    .update(esquema.webhookEvents)
    .set({ processedAt: new Date() })
    .where(eq(esquema.webhookEvents.eventId, eventId));
}

async function recibirMensaje(ev: WebhookMensajeRecibido) {
  const mensaje = mensajeDesdeWebhook(ev);
  if (!mensaje) return null; // plataforma fuera de alcance

  return registrarEntrante({
    mensaje,
    conversacion: {
      externalId: ev.conversation.platformConversationId || ev.conversation.id,
      participantId: ev.conversation.participantId ?? ev.message.sender.id,
      participantName: ev.conversation.participantName ?? ev.message.sender.name ?? null,
      participantHandle: ev.conversation.participantUsername ?? ev.message.sender.username ?? null,
      participantPicture: ev.conversation.participantPicture ?? null,
      // De qué campaña vino el lead no se puede recuperar después: se guarda ya.
      metadata: ev.metadata ?? null,
    },
    cuentaExternalId: ev.account.accountId ?? ev.account.id,
  });
}

async function actualizarEstado(ev: WebhookEstadoEntrega): Promise<void> {
  const externalId = ev.message.platformMessageId || ev.message.id;
  const estado =
    ev.event === "message.delivered" ? "delivered" : ev.event === "message.read" ? "read" : "failed";

  await db
    .update(esquema.messages)
    .set({ status: estado, error: ev.error?.message?.slice(0, 500) ?? null })
    .where(eq(esquema.messages.externalId, externalId));
}

async function actualizarCuenta(ev: WebhookCuentaConectada): Promise<void> {
  await db
    .update(esquema.channelAccounts)
    .set({ connected: ev.event === "account.connected" })
    .where(eq(esquema.channelAccounts.externalId, ev.account.accountId));
}
