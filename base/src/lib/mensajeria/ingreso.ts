import { and, eq, sql } from "drizzle-orm";
import { db, esquema } from "@/lib/db";
import type { MensajeProveedor } from "@/lib/canales/tipos";

export interface DatosConversacion {
  externalId: string;
  participantId: string;
  participantName?: string | null;
  participantHandle?: string | null;
  participantPicture?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface ResultadoIngreso {
  conversationId: string;
  messageId: string | null;
  /** false = el mensaje ya estaba (reintento del proveedor). No dispares el agente. */
  esNuevo: boolean;
}

/**
 * Persiste un mensaje entrante. Lo usa el webhook y también la importación de historial.
 *
 * Devuelve null cuando la cuenta no está conectada en este CRM: ese evento se ignora
 * con 200, no con error. Un 500 acá, diez veces seguidas, y el proveedor apaga la
 * suscripción entera.
 */
export async function registrarEntrante(opts: {
  mensaje: MensajeProveedor;
  conversacion: DatosConversacion;
  cuentaExternalId: string;
  provider?: string;
}): Promise<ResultadoIngreso | null> {
  const provider = opts.provider ?? "zernio";
  const { mensaje, conversacion } = opts;

  // 1 · Rutear por la cuenta. Sin match, no es nuestro.
  const cuenta = await db.query.channelAccounts.findFirst({
    where: eq(esquema.channelAccounts.externalId, opts.cuentaExternalId),
  });
  if (!cuenta) return null;

  // 2 · Resolver el contacto por identidad, no por teléfono: Instagram y Messenger no
  //     tienen número, y en WhatsApp el teléfono puede venir nulo.
  const contactId = await resolverContacto({
    channel: mensaje.channel,
    externalId: mensaje.senderExternalId,
    nombre: mensaje.senderName,
    telefono: mensaje.senderPhone,
    handle: conversacion.participantHandle ?? null,
  });

  // 3 · Crear o actualizar la conversación.
  const [conv] = await db
    .insert(esquema.conversations)
    .values({
      channel: mensaje.channel,
      provider,
      externalId: conversacion.externalId,
      accountId: cuenta.id,
      contactId,
      participantId: conversacion.participantId,
      participantName: conversacion.participantName ?? null,
      participantHandle: conversacion.participantHandle ?? null,
      participantPicture: conversacion.participantPicture ?? null,
      lastMessageAt: mensaje.sentAt,
      lastInboundAt: mensaje.direction === "inbound" ? mensaje.sentAt : null,
      metadata: conversacion.metadata ?? null,
    })
    .onConflictDoUpdate({
      target: [esquema.conversations.provider, esquema.conversations.externalId],
      set: {
        participantName: conversacion.participantName ?? null,
        participantPicture: conversacion.participantPicture ?? null,
        lastMessageAt: mensaje.sentAt,
        // La atribución del anuncio no se pisa: gana el primer referral.
        contactId: sql`coalesce(${esquema.conversations.contactId}, ${contactId})`,
      },
    })
    .returning();

  if (!conv) return null;

  // 4 · Insertar el mensaje. El índice único sobre external_id hace la idempotencia:
  //     si ya estaba, no devuelve fila y sabemos que es un reintento.
  const [fila] = await db
    .insert(esquema.messages)
    .values({
      conversationId: conv.id,
      channel: mensaje.channel,
      provider,
      externalId: mensaje.externalId,
      direction: mensaje.direction,
      type: mensaje.attachments.length > 0 ? (mensaje.attachments[0]?.type ?? "file") : "text",
      body: mensaje.body,
      author: mensaje.direction === "inbound" ? "contact" : "human",
      status: "delivered",
      attachments: mensaje.attachments.length > 0 ? mensaje.attachments : null,
      sentAt: mensaje.sentAt,
    })
    .onConflictDoNothing()
    .returning();

  if (!fila) return { conversationId: conv.id, messageId: null, esNuevo: false };

  // 5 · Recién ahora movemos los contadores del hilo.
  if (mensaje.direction === "inbound") {
    await db
      .update(esquema.conversations)
      .set({
        lastInboundAt: mensaje.sentAt,
        lastMessageAt: mensaje.sentAt,
        unreadCount: sql`${esquema.conversations.unreadCount} + 1`,
      })
      .where(eq(esquema.conversations.id, conv.id));
  }

  return { conversationId: conv.id, messageId: fila.id, esNuevo: true };
}

/** Devuelve el id del contacto, creándolo si es la primera vez que escribe por ese canal. */
async function resolverContacto(opts: {
  channel: (typeof esquema.CANALES)[number];
  externalId: string;
  nombre: string | null;
  telefono: string | null;
  handle: string | null;
}): Promise<string> {
  const existente = await db.query.contactIdentities.findFirst({
    where: and(
      eq(esquema.contactIdentities.channel, opts.channel),
      eq(esquema.contactIdentities.externalId, opts.externalId),
    ),
  });
  if (existente) return existente.contactId;

  const [contacto] = await db
    .insert(esquema.contacts)
    .values({
      // El nombre lo escribe la persona del otro lado: es dato no confiable.
      // Se guarda como texto y se escapa siempre al mostrarlo.
      name: opts.nombre,
      phone: opts.telefono,
    })
    .returning();

  if (!contacto) throw new Error("No se pudo crear el contacto");

  await db
    .insert(esquema.contactIdentities)
    .values({
      contactId: contacto.id,
      channel: opts.channel,
      externalId: opts.externalId,
      handle: opts.handle,
    })
    .onConflictDoNothing();

  return contacto.id;
}
