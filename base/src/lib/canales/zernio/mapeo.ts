import type { Canal } from "@db/esquema";
import type {
  ConversacionProveedor,
  MensajeProveedor,
  CuentaProveedor,
} from "../tipos";
import type {
  RestConversacion,
  RestCuenta,
  RestMensaje,
  WebhookMensajeRecibido,
} from "./tipos";

/**
 * `platform` del proveedor → `channel` nuestro.
 * Devuelve null para las plataformas fuera de alcance (telegram, sms, twitter...):
 * esas conversaciones se ignoran, no se fuerzan a un canal que no son.
 */
export function aCanal(platform: string): Canal | null {
  switch (platform) {
    case "whatsapp":
      return "whatsapp";
    case "instagram":
      return "instagram";
    case "facebook":
      return "facebook";
    default:
      return null;
  }
}

function fecha(valor: string | undefined | null): Date | null {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function conversacionDesdeRest(c: RestConversacion): ConversacionProveedor | null {
  const channel = aCanal(c.platform);
  if (!channel) return null;
  return {
    externalId: c.id,
    channel,
    accountExternalId: c.accountId,
    participantId: c.participantId,
    participantName: c.participantName ?? null,
    participantHandle: c.accountUsername ?? null,
    participantPicture: c.participantPicture ?? null,
    lastMessage: c.lastMessage ?? null,
    updatedAt: fecha(c.updatedTime),
    unreadCount: c.unreadCount ?? 0,
    metadata: c.metadata ?? null,
  };
}

export function mensajeDesdeRest(m: RestMensaje): MensajeProveedor | null {
  const channel = aCanal(m.platform);
  if (!channel) return null;
  return {
    externalId: m.id,
    conversationExternalId: m.conversationId,
    channel,
    direction: m.direction === "incoming" ? "inbound" : "outbound",
    // En el REST el texto se llama `message`.
    body: m.message ?? null,
    senderExternalId: m.senderId,
    senderName: m.senderName ?? null,
    senderPhone: null, // el REST no lo devuelve; solo llega por webhook
    sentAt: fecha(m.createdAt) ?? new Date(),
    attachments: (m.attachments ?? []).map((a) => ({
      type: a.type,
      url: a.url,
      refreshUrl: a.refreshUrl ?? null,
      filename: a.filename ?? null,
    })),
  };
}

/**
 * Webhook → dominio. Los nombres son otros que en el REST: `text` en vez de `message`,
 * `sender.id` en vez de `senderId`, `platformMessageId` como id de la plataforma.
 */
export function mensajeDesdeWebhook(ev: WebhookMensajeRecibido): MensajeProveedor | null {
  const channel = aCanal(ev.message.platform);
  if (!channel) return null;
  return {
    externalId: ev.message.platformMessageId || ev.message.id,
    conversationExternalId: ev.conversation.platformConversationId || ev.conversation.id,
    channel,
    direction: ev.message.direction === "incoming" ? "inbound" : "outbound",
    body: ev.message.text,
    senderExternalId: ev.message.sender.id,
    senderName: ev.message.sender.name ?? null,
    senderPhone: ev.message.sender.phoneNumber ?? null,
    sentAt: fecha(ev.message.sentAt) ?? new Date(),
    attachments: (ev.message.attachments ?? []).map((a) => ({
      type: a.type,
      // Guardamos refreshUrl porque la url firmada de Meta vence.
      url: a.url,
      refreshUrl: a.refreshUrl ?? null,
      filename: a.filename ?? null,
    })),
  };
}

export function cuentaDesdeRest(c: RestCuenta): CuentaProveedor | null {
  const channel = aCanal(c.platform);
  if (!channel) return null;
  return {
    externalId: c.id,
    channel,
    username: c.username ?? null,
    displayName: c.displayName ?? null,
    profileId: c.profileId ?? null,
  };
}
