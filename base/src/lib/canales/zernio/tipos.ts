/**
 * Tipos de Zernio, escritos contra el OpenAPI real (3.1.0, versión 1.0.4, bajado el
 * 17/08/2026 de https://docs.zernio.com/api/openapi).
 *
 * LO MÁS IMPORTANTE DE ESTE ARCHIVO: la forma que llega por webhook y la que devuelve
 * el REST NO coinciden en los nombres de los campos. Son dos familias de tipos
 * distintas, a propósito. Si las unificás, el `text` te queda undefined en cada mensaje
 * entrante y el INSERT guarda filas vacías sin un solo error.
 *
 * `npm run verificar:openapi` compara estos nombres contra el spec de hoy.
 */

/** El proveedor usa `platform`. `facebook` es Messenger: no existe el valor "messenger". */
export type PlataformaZernio =
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "telegram"
  | "sms"
  | "twitter"
  | "bluesky"
  | "reddit";

// ===========================================================================
// Familia 1 · lo que devuelve el REST
// ===========================================================================

export interface RestConversacion {
  id: string;
  platform: string;
  accountId: string;
  accountUsername?: string;
  participantId: string;
  participantName?: string;
  participantPicture?: string | null;
  lastMessage?: string;
  updatedTime?: string;
  status?: "active" | "archived";
  unreadCount?: number | null;
  url?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface RestListaConversaciones {
  data: RestConversacion[];
  pagination?: { hasMore?: boolean; nextCursor?: string | null };
}

export interface RestMensaje {
  id: string;
  conversationId: string;
  accountId: string;
  platform: string;
  /** OJO: acá el texto se llama `message`. En el webhook se llama `text`. */
  message: string;
  senderId: string;
  senderName?: string | null;
  direction: "incoming" | "outgoing";
  createdAt: string;
  attachments?: RestAdjunto[];
}

export interface RestAdjunto {
  id: string;
  type: "image" | "video" | "audio" | "file" | "sticker" | "share";
  /** En Instagram y Facebook esta url VENCE. Guardá refreshUrl. */
  url: string;
  refreshUrl?: string | null;
  filename?: string | null;
  previewUrl?: string | null;
}

export interface RestListaMensajes {
  status?: string;
  messages: RestMensaje[];
  pagination?: { hasMore?: boolean; nextCursor?: string | null };
  sortOrderApplied?: "asc" | "desc";
}

export interface RestCuenta {
  id: string;
  platform: string;
  username?: string;
  displayName?: string;
  profileId?: string;
}

// ===========================================================================
// Familia 2 · lo que llega por webhook
// ===========================================================================

export interface WebhookRemitente {
  id: string;
  contactId?: string;
  name?: string;
  username?: string;
  picture?: string;
  /** Puede venir null incluso en WhatsApp. El ancla es `id`, no el teléfono. */
  phoneNumber?: string | null;
}

export interface WebhookMensaje {
  id: string;
  conversationId: string;
  platform: PlataformaZernio;
  platformMessageId: string;
  direction: "incoming" | "outgoing";
  /** Acá el texto se llama `text`. En el REST se llama `message`. */
  text: string | null;
  attachments: RestAdjunto[];
  sender: WebhookRemitente;
  sentAt: string;
  isRead: boolean;
}

export interface WebhookConversacion {
  id: string;
  platformConversationId: string;
  participantId?: string;
  participantName?: string;
  participantUsername?: string;
  participantPicture?: string;
  status: "active" | "archived";
  contactId?: string;
}

export interface WebhookCuenta {
  id: string;
  /** Mismo valor que `id`. Es el campo canónico para filtrar y rutear. */
  accountId: string;
  profileId?: string;
  platform: string;
  username: string;
  displayName?: string;
}

/** Raíz común a toda entrega. `id` es el id estable del evento: ese va a webhook_events. */
export interface WebhookBase {
  id: string;
  event: string;
  /** Cuándo Zernio GENERÓ el evento, no cuándo lo entregó. */
  timestamp: string;
}

export interface WebhookMensajeRecibido extends WebhookBase {
  event: "message.received";
  message: WebhookMensaje;
  conversation: WebhookConversacion;
  account: WebhookCuenta;
  metadata?: Record<string, unknown> | null;
}

export interface WebhookEstadoEntrega extends WebhookBase {
  event: "message.delivered" | "message.read" | "message.failed";
  message: WebhookMensaje;
  statusAt: string;
  error?: { message?: string; code?: string | number } | null;
  conversation: WebhookConversacion;
  account: WebhookCuenta;
}

export interface WebhookConversacionIniciada extends WebhookBase {
  event: "conversation.started";
  conversation: WebhookConversacion & { platform: string };
  account: WebhookCuenta;
  startedAt: string;
}

export interface WebhookReferral extends WebhookBase {
  event: "referral.received";
  referral: Record<string, unknown>;
  sender: { id: string; contactId?: string };
  conversation: WebhookConversacion;
  account: WebhookCuenta;
}

export interface WebhookCuentaConectada extends WebhookBase {
  event: "account.connected" | "account.disconnected";
  account: { accountId: string; profileId?: string; platform: string; username: string; displayName?: string };
}

export type EventoZernio =
  | WebhookMensajeRecibido
  | WebhookEstadoEntrega
  | WebhookConversacionIniciada
  | WebhookReferral
  | WebhookCuentaConectada
  | (WebhookBase & { [k: string]: unknown });
