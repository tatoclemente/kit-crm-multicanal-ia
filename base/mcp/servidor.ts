/**
 * Servidor MCP del CRM: expone la bandeja como herramientas para que Claude Code, Codex
 * u otro agente puedan trabajar sobre el CRM desde afuera.
 *
 * Todo lo que ESCRIBE pasa por las mismas funciones que usa la app: no hay un segundo
 * camino de salida ni un segundo lugar donde se toque la base.
 *
 *   npm run mcp
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { desc, eq } from "drizzle-orm";
import { db, esquema } from "../src/lib/db";
import { entregarMensaje } from "../src/lib/mensajeria/entregar";
import { estadoDeVentana } from "../src/lib/mensajeria/ventana";

const servidor = new Server(
  { name: "crm-multicanal", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

servidor.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "listar_conversaciones",
      description: "Lista las conversaciones más recientes del CRM, con canal, contacto y estado.",
      inputSchema: {
        type: "object",
        properties: {
          canal: { type: "string", enum: ["whatsapp", "instagram", "facebook"] },
          limite: { type: "number", description: "Cuántas traer (por defecto 20)" },
        },
      },
    },
    {
      name: "leer_conversacion",
      description: "Devuelve los mensajes de una conversación y si la ventana de 24 horas está abierta.",
      inputSchema: {
        type: "object",
        properties: { conversationId: { type: "string" } },
        required: ["conversationId"],
      },
    },
    {
      name: "responder",
      description:
        "Envía un mensaje en una conversación. ESCRIBE Y ENVÍA DE VERDAD a una persona real: pedí confirmación antes de usarlo.",
      inputSchema: {
        type: "object",
        properties: {
          conversationId: { type: "string" },
          texto: { type: "string" },
        },
        required: ["conversationId", "texto"],
      },
    },
    {
      name: "pausar_agente",
      description: "Apaga o prende la IA en una conversación puntual, para que la atienda una persona.",
      inputSchema: {
        type: "object",
        properties: {
          conversationId: { type: "string" },
          activar: { type: "boolean" },
        },
        required: ["conversationId", "activar"],
      },
    },
  ],
}));

servidor.setRequestHandler(CallToolRequestSchema, async (pedido) => {
  const args = (pedido.params.arguments ?? {}) as Record<string, unknown>;

  try {
    switch (pedido.params.name) {
      case "listar_conversaciones": {
        const limite = Math.min(Number(args.limite ?? 20), 100);
        const filas = await db
          .select({
            id: esquema.conversations.id,
            canal: esquema.conversations.channel,
            contacto: esquema.conversations.participantName,
            ultimo: esquema.conversations.lastMessageAt,
            sinLeer: esquema.conversations.unreadCount,
            iaActiva: esquema.conversations.aiEnabled,
          })
          .from(esquema.conversations)
          .orderBy(desc(esquema.conversations.lastMessageAt))
          .limit(limite);

        const filtradas = args.canal ? filas.filter((f) => f.canal === args.canal) : filas;
        return texto(JSON.stringify(filtradas, null, 2));
      }

      case "leer_conversacion": {
        const id = String(args.conversationId);
        const conv = await db.query.conversations.findFirst({
          where: eq(esquema.conversations.id, id),
        });
        if (!conv) return texto("No existe esa conversación.");

        const mensajes = await db
          .select({
            direccion: esquema.messages.direction,
            autor: esquema.messages.author,
            texto: esquema.messages.body,
            fecha: esquema.messages.sentAt,
          })
          .from(esquema.messages)
          .where(eq(esquema.messages.conversationId, id))
          .orderBy(desc(esquema.messages.sentAt))
          .limit(50);

        const ventana = estadoDeVentana(conv.channel, conv.lastInboundAt);
        return texto(
          JSON.stringify(
            { canal: conv.channel, contacto: conv.participantName, ventana, mensajes: mensajes.reverse() },
            null,
            2,
          ),
        );
      }

      case "responder": {
        const res = await entregarMensaje({
          conversationId: String(args.conversationId),
          texto: String(args.texto),
          autor: "human",
        });
        return texto(res.ok ? `Enviado (id ${res.messageId}).` : `No se envió: ${res.motivo}`);
      }

      case "pausar_agente": {
        await db
          .update(esquema.conversations)
          .set({ aiEnabled: args.activar === true })
          .where(eq(esquema.conversations.id, String(args.conversationId)));
        return texto(args.activar === true ? "IA activada en ese hilo." : "IA pausada en ese hilo.");
      }

      default:
        return texto(`Herramienta desconocida: ${pedido.params.name}`);
    }
  } catch (e) {
    return texto(`Error: ${e instanceof Error ? e.message : String(e)}`);
  }
});

function texto(contenido: string) {
  return { content: [{ type: "text" as const, text: contenido }] };
}

// stdout es el canal del protocolo: los logs van a stderr o rompen la conexión.
const transporte = new StdioServerTransport();
await servidor.connect(transporte);
console.error("[mcp] servidor del CRM listo");
