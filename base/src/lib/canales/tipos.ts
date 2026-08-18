import type { Canal } from "@db/esquema";

/**
 * Contrato de un proveedor de canales. Zernio es el que viene implementado; Meta Cloud
 * API u otro se agregan escribiendo otro módulo que cumpla esta interfaz, sin tocar el
 * resto del CRM.
 *
 * Regla: ningún método tira excepción. Un canal caído no puede voltear el request
 * entero. Todo devuelve Resultado.
 */
export type Resultado<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; estado?: number };

export interface CuentaProveedor {
  externalId: string;
  channel: Canal;
  username: string | null;
  displayName: string | null;
  profileId: string | null;
}

export interface ConversacionProveedor {
  externalId: string;
  channel: Canal;
  accountExternalId: string;
  participantId: string;
  participantName: string | null;
  participantHandle: string | null;
  participantPicture: string | null;
  lastMessage: string | null;
  updatedAt: Date | null;
  unreadCount: number;
  metadata: Record<string, unknown> | null;
}

export interface MensajeProveedor {
  externalId: string;
  conversationExternalId: string;
  channel: Canal;
  direction: "inbound" | "outbound";
  body: string | null;
  senderExternalId: string;
  senderName: string | null;
  senderPhone: string | null;
  sentAt: Date;
  attachments: AdjuntoProveedor[];
}

export interface AdjuntoProveedor {
  type: string;
  /** En Instagram y Facebook la url vence. Persistí refreshUrl. */
  url?: string;
  refreshUrl?: string | null;
  filename?: string | null;
}

export interface EnvioMensaje {
  conversationExternalId: string;
  accountExternalId: string;
  text: string;
  attachmentUrl?: string;
  /** WhatsApp fuera de ventana: envío de utilidad sin plantilla aprobada. */
  fueraDeVentana?: boolean;
}

export interface ProveedorDeCanales {
  readonly nombre: string;
  listarCuentas(): Promise<Resultado<CuentaProveedor[]>>;
  listarConversaciones(opts?: {
    channel?: Canal;
    limite?: number;
  }): AsyncGenerator<ConversacionProveedor, void, void>;
  listarMensajes(
    conversationExternalId: string,
    accountExternalId: string,
    opts?: { limite?: number },
  ): Promise<Resultado<MensajeProveedor[]>>;
  enviarMensaje(envio: EnvioMensaje): Promise<Resultado<{ externalId: string | null }>>;
  /** Abrir un hilo nuevo es un endpoint distinto al de responder en uno existente. */
  abrirConversacion(opts: {
    accountExternalId: string;
    participantId: string;
    text: string;
  }): Promise<Resultado<{ conversationExternalId: string }>>;
  verificarFirma(bodyCrudo: string, firma: string | null): boolean;
}
