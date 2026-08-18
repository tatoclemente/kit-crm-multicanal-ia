import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, esquema } from "@/lib/db";

/**
 * Webhooks salientes: el CRM avisa a donde el cliente diga. Es lo que lo hace
 * integrable con cualquier cosa (n8n, Make, un sistema propio) sin que nosotros
 * escribamos un conector por herramienta.
 *
 * Firmamos igual que hace el proveedor con nosotros: HMAC-SHA256 sobre el body crudo,
 * en el header X-CRM-Signature. Del otro lado se verifica igual.
 */
export type EventoSaliente =
  | "message.inbound"
  | "message.outbound"
  | "conversation.created"
  | "conversation.stage_changed"
  | "conversation.handoff"
  | "contact.qualified"
  | "task.created";

export async function emitirEvento(
  evento: EventoSaliente,
  datos: Record<string, unknown>,
): Promise<void> {
  const suscriptos = await db.query.outboundWebhooks.findMany({
    where: eq(esquema.outboundWebhooks.active, true),
  });

  const payload = {
    id: crypto.randomUUID(),
    event: evento,
    timestamp: new Date().toISOString(),
    data: datos,
  };
  const cuerpo = JSON.stringify(payload);

  await Promise.all(
    suscriptos
      .filter((w) => w.events.length === 0 || w.events.includes(evento))
      .map((w) => entregar(w, evento, payload, cuerpo)),
  );
}

async function entregar(
  webhook: typeof esquema.outboundWebhooks.$inferSelect,
  evento: string,
  payload: Record<string, unknown>,
  cuerpo: string,
): Promise<void> {
  const firma = createHmac("sha256", webhook.secret).update(cuerpo, "utf8").digest("hex");

  let estado: number | null = null;
  let error: string | null = null;

  try {
    const res = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CRM-Signature": firma,
        "X-CRM-Event": evento,
      },
      body: cuerpo,
      signal: AbortSignal.timeout(10_000),
    });
    estado = res.status;
    if (!res.ok) error = `respuesta ${res.status}`;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  await db.insert(esquema.outboundDeliveries).values({
    webhookId: webhook.id,
    event: evento,
    payload,
    statusCode: estado,
    error,
    deliveredAt: error ? null : new Date(),
  });

  // Mismo criterio que usa el proveedor con nosotros: a los 10 fallos seguidos se apaga.
  if (error) {
    const fallos = webhook.failureCount + 1;
    await db
      .update(esquema.outboundWebhooks)
      .set({ failureCount: fallos, active: fallos < 10 })
      .where(eq(esquema.outboundWebhooks.id, webhook.id));
  } else if (webhook.failureCount > 0) {
    await db
      .update(esquema.outboundWebhooks)
      .set({ failureCount: 0, lastFiredAt: new Date() })
      .where(eq(esquema.outboundWebhooks.id, webhook.id));
  }
}
