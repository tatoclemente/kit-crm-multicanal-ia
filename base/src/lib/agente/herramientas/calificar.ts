import { eq, sql } from "drizzle-orm";
import { db, esquema } from "@/lib/db";
import { emitirEvento } from "@/lib/integraciones/salientes";
import type { Herramienta } from "./tipos";

/** Guarda en la ficha del contacto lo que el agente averiguó en la conversación. */
export const calificar: Herramienta = {
  nombre: "calificar_contacto",
  descripcion:
    "Guarda los datos que averiguaste de la persona (nombre, qué busca, presupuesto, zona, urgencia). Usalo apenas tengas un dato nuevo, no esperes al final de la charla.",
  parametros: {
    type: "object",
    properties: {
      nombre: { type: "string", description: "Nombre de la persona, si lo dijo" },
      email: { type: "string", description: "Correo, si lo dio" },
      datos: {
        type: "object",
        description:
          "Pares campo/valor con lo que definió el negocio: qué busca, presupuesto, zona, urgencia. Solo lo que la persona dijo de verdad.",
        additionalProperties: true,
      },
      resumen: { type: "string", description: "Una línea sobre qué necesita esta persona" },
    },
    required: ["datos"],
  },

  async ejecutar(args, ctx) {
    if (!ctx.contactId) return "No hay contacto asociado a esta conversación.";

    const datos = (args.datos as Record<string, unknown>) ?? {};
    const nombre = typeof args.nombre === "string" ? args.nombre : null;
    const email = typeof args.email === "string" ? args.email : null;

    await db
      .update(esquema.contacts)
      .set({
        ...(nombre ? { name: nombre } : {}),
        ...(email ? { email } : {}),
        // Merge, no reemplazo: lo que ya sabíamos no se pierde.
        fields: sql`${esquema.contacts.fields} || ${JSON.stringify(datos)}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(esquema.contacts.id, ctx.contactId));

    void emitirEvento("contact.qualified", {
      contactId: ctx.contactId,
      conversationId: ctx.conversationId,
      datos,
      resumen: args.resumen ?? null,
    });

    return "Datos guardados en la ficha del contacto.";
  },
};
