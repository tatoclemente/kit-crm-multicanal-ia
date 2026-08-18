import type { Canal } from "@db/esquema";
import type {
  ConversacionProveedor,
  EnvioMensaje,
  MensajeProveedor,
  Resultado,
} from "../tipos";
import { pedir } from "./cliente";
import { conversacionDesdeRest, mensajeDesdeRest } from "./mapeo";
import type { RestListaConversaciones, RestListaMensajes } from "./tipos";

/** Paginación por generador: el que consume decide cuándo parar. */
export async function* listarConversaciones(opts: {
  channel?: Canal;
  limite?: number;
} = {}): AsyncGenerator<ConversacionProveedor, void, void> {
  let cursor: string | undefined;
  const limite = opts.limite ?? 50;

  do {
    const res = await pedir<RestListaConversaciones>("/v1/inbox/conversations", {
      query: { platform: opts.channel, limit: limite, cursor, sortOrder: "desc" },
    });
    if (!res.ok) return;

    for (const cruda of res.data.data ?? []) {
      const conv = conversacionDesdeRest(cruda);
      if (conv) yield conv;
    }

    cursor = res.data.pagination?.nextCursor ?? undefined;
  } while (cursor);
}

export async function listarMensajes(
  conversationExternalId: string,
  accountExternalId: string,
  opts: { limite?: number } = {},
): Promise<Resultado<MensajeProveedor[]>> {
  const res = await pedir<RestListaMensajes>(
    `/v1/inbox/conversations/${encodeURIComponent(conversationExternalId)}/messages`,
    { query: { accountId: accountExternalId, limit: opts.limite ?? 50, sortOrder: "asc" } },
  );
  if (!res.ok) return res;

  const mensajes = (res.data.messages ?? [])
    .map(mensajeDesdeRest)
    .filter((m): m is MensajeProveedor => m !== null);

  return { ok: true, data: mensajes };
}

/** Responder en un hilo abierto. */
export async function enviarMensaje(
  envio: EnvioMensaje,
): Promise<Resultado<{ externalId: string | null }>> {
  const cuerpo: Record<string, unknown> = {
    accountId: envio.accountExternalId,
    message: envio.text,
  };
  if (envio.attachmentUrl) cuerpo.attachmentUrl = envio.attachmentUrl;
  // WhatsApp fuera de la ventana de 24 h: envío de utilidad sin plantilla aprobada.
  if (envio.fueraDeVentana) cuerpo.category = "utility";

  const res = await pedir<{ id?: string; messageId?: string }>(
    `/v1/inbox/conversations/${encodeURIComponent(envio.conversationExternalId)}/messages`,
    { metodo: "POST", cuerpo },
  );
  if (!res.ok) return res;

  return { ok: true, data: { externalId: res.data?.id ?? res.data?.messageId ?? null } };
}

/** Abrir un hilo NUEVO es un endpoint distinto al de responder en uno existente. */
export async function abrirConversacion(opts: {
  accountExternalId: string;
  participantId: string;
  text: string;
}): Promise<Resultado<{ conversationExternalId: string }>> {
  const res = await pedir<{ id?: string; conversationId?: string }>(
    "/v1/inbox/conversations",
    {
      metodo: "POST",
      cuerpo: {
        accountId: opts.accountExternalId,
        participantId: opts.participantId,
        message: opts.text,
      },
    },
  );
  if (!res.ok) return res;

  const id = res.data?.conversationId ?? res.data?.id;
  if (!id) return { ok: false, error: "El proveedor no devolvió id de conversación" };
  return { ok: true, data: { conversationExternalId: id } };
}

export async function marcarLeida(
  conversationExternalId: string,
  accountExternalId: string,
): Promise<Resultado<unknown>> {
  return pedir(
    `/v1/inbox/conversations/${encodeURIComponent(conversationExternalId)}/read`,
    { metodo: "POST", cuerpo: { accountId: accountExternalId } },
  );
}
