import { eq } from "drizzle-orm";
import { db, esquema } from "@/lib/db";
import { emitirEvento } from "@/lib/integraciones/salientes";
import type { Herramienta } from "./tipos";

/**
 * Apaga la IA en esta conversación y avisa al equipo. Sin esto, un agente que no
 * entiende algo deja al cliente colgado.
 */
export const derivar: Herramienta = {
  nombre: "derivar_a_humano",
  descripcion:
    "Pasá la conversación a una persona del equipo. Usalo cuando te lo pidan, cuando el tema exceda lo que podés resolver, cuando haya un reclamo o cuando la persona esté enojada. Después de llamarlo, avisale a la persona que en un rato la contesta alguien del equipo.",
  parametros: {
    type: "object",
    properties: {
      motivo: {
        type: "string",
        description: "Por qué derivás, en una línea. Lo lee el equipo, no el cliente.",
      },
      urgente: { type: "boolean", description: "true si no puede esperar al día siguiente" },
    },
    required: ["motivo"],
  },

  async ejecutar(args, ctx) {
    const motivo = String(args.motivo ?? "sin motivo").slice(0, 300);
    const urgente = args.urgente === true;

    await db
      .update(esquema.conversations)
      .set({ aiEnabled: false })
      .where(eq(esquema.conversations.id, ctx.conversationId));

    await db.insert(esquema.tasks).values({
      title: urgente ? `URGENTE · Atender conversación` : "Atender conversación derivada",
      detail: motivo,
      conversationId: ctx.conversationId,
      contactId: ctx.contactId,
      dueAt: new Date(Date.now() + (urgente ? 30 : 8 * 60) * 60 * 1000),
      createdBy: "agent",
    });

    void emitirEvento("conversation.handoff", {
      conversationId: ctx.conversationId,
      contactId: ctx.contactId,
      motivo,
      urgente,
    });

    return "Listo: la IA quedó apagada en este hilo y se creó la tarea para el equipo. Avisale a la persona que la contesta alguien del equipo.";
  },
};
