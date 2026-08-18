import { createHmac, timingSafeEqual } from "node:crypto";
import { entorno } from "@/lib/entorno";
import type { Resultado } from "../tipos";
import { pedir } from "./cliente";

/** Header de firma verificado contra el spec: HMAC-SHA256 sobre el body crudo. */
export const HEADER_FIRMA = "x-zernio-signature";

/** Eventos que consume el CRM. El resto se registra y se responde 200. */
export const EVENTOS_SUSCRITOS = [
  "message.received",
  "conversation.started",
  "message.sent",
  "message.delivered",
  "message.read",
  "message.failed",
  "referral.received",
  "account.connected",
  "account.disconnected",
] as const;

interface WebhookRegistrado {
  _id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  failureCount?: number;
  lastFiredAt?: string;
}

/**
 * Verifica la firma sobre el body CRUDO. Si parseás el JSON y lo volvés a serializar,
 * la firma nunca valida: cambian los espacios y el orden de las claves.
 *
 * Fail-closed: la firma es OPCIONAL del lado del proveedor, así que sin secreto
 * configurado rechazamos todo en vez de aceptar todo. Si no, cualquiera que descubra
 * la URL puede inyectar conversaciones.
 */
export function verificarFirma(bodyCrudo: string, firma: string | null): boolean {
  const secreto = entorno.ZERNIO_WEBHOOK_SECRET;
  if (!secreto || !firma) return false;

  // Algunos proveedores prefijan el algoritmo. Aceptamos las dos formas.
  const recibida = firma.includes("=") ? (firma.split("=").pop() ?? "") : firma;
  const esperada = createHmac("sha256", secreto).update(bodyCrudo, "utf8").digest("hex");

  // Chequeo de longitud ANTES de la comparación: timingSafeEqual tira si difieren.
  if (recibida.length !== esperada.length) return false;

  try {
    return timingSafeEqual(Buffer.from(recibida, "hex"), Buffer.from(esperada, "hex"));
  } catch {
    return false;
  }
}

export async function listarWebhooks(): Promise<Resultado<WebhookRegistrado[]>> {
  const res = await pedir<{ webhooks?: WebhookRegistrado[] }>("/v1/webhooks/settings");
  if (!res.ok) return res;
  return { ok: true, data: res.data?.webhooks ?? [] };
}

/**
 * Registra el webhook POR API, no a mano en el panel. Busca por nombre y actualiza si
 * ya existe: los proveedores no suelen validar URLs duplicadas y terminás recibiendo
 * cada evento dos o tres veces.
 */
export async function registrarWebhook(opts: {
  nombre: string;
  url: string;
  secreto: string;
}): Promise<Resultado<{ id: string; creado: boolean }>> {
  const existentes = await listarWebhooks();
  if (!existentes.ok) return existentes;

  const previo = existentes.data.find((w) => w.name === opts.nombre);
  const eventos = [...EVENTOS_SUSCRITOS];

  if (previo) {
    const res = await pedir<{ success: boolean }>("/v1/webhooks/settings", {
      metodo: "PUT",
      cuerpo: {
        _id: previo._id,
        name: opts.nombre,
        url: opts.url,
        secret: opts.secreto,
        events: eventos,
        isActive: true,
      },
    });
    if (!res.ok) return res;
    return { ok: true, data: { id: previo._id, creado: false } };
  }

  const res = await pedir<{ success: boolean; webhook?: WebhookRegistrado }>(
    "/v1/webhooks/settings",
    {
      metodo: "POST",
      cuerpo: {
        name: opts.nombre,
        url: opts.url,
        secret: opts.secreto,
        events: eventos,
        isActive: true,
      },
    },
  );
  if (!res.ok) return res;

  const id = res.data?.webhook?._id;
  if (!id) return { ok: false, error: "El proveedor no devolvió el id del webhook" };
  return { ok: true, data: { id, creado: true } };
}

export async function borrarWebhook(id: string): Promise<Resultado<unknown>> {
  return pedir("/v1/webhooks/settings", { metodo: "DELETE", query: { id } });
}
