import { z } from "zod";
import { entregarMensaje } from "@/lib/mensajeria/entregar";

export const runtime = "nodejs";

/**
 * UN SOLO endpoint de envío para toda la interfaz. Recibe { conversationId, texto } y
 * pasa por entregarMensaje. No hay otro lugar de la app que inserte un mensaje saliente.
 */
const cuerpo = z.object({
  conversationId: z.string().uuid(),
  texto: z.string().min(1).max(4000),
  /** Solo una persona puede forzar un envío fuera de la ventana de 24 horas. */
  forzarFueraDeVentana: z.boolean().optional(),
});

export async function POST(req: Request): Promise<Response> {
  // PENDIENTE (Fase 4): exigir sesión de Supabase Auth y tomar el usuario de ahí.
  const datos = cuerpo.safeParse(await req.json().catch(() => null));
  if (!datos.success) {
    return Response.json({ error: "Pedido inválido", detalle: datos.error.flatten() }, { status: 400 });
  }

  const res = await entregarMensaje({
    conversationId: datos.data.conversationId,
    texto: datos.data.texto,
    autor: "human",
    forzarFueraDeVentana: datos.data.forzarFueraDeVentana,
  });

  if (!res.ok) {
    const estado = res.codigo === "fuera-de-ventana" ? 409 : res.codigo === "sin-conversacion" ? 404 : 502;
    return Response.json({ error: res.motivo, codigo: res.codigo }, { status: estado });
  }

  return Response.json({ ok: true, messageId: res.messageId });
}
