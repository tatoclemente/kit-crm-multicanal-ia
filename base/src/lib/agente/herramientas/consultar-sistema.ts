import { llamarSistema, sistemaExterno } from "@/lib/integraciones/registro";
import type { Herramienta } from "./tipos";

/**
 * La herramienta que hace que el agente sirva de verdad en una tienda o un servicio
 * técnico: consulta el sistema que el negocio ya usa, en vez de inventar.
 *
 * Si el adaptador no implementa una operación, se lo dice al modelo y el modelo lo
 * explica. Nunca se completa con una suposición.
 */
export const consultarSistema: Herramienta = {
  nombre: "consultar_sistema",
  descripcion:
    "Consultá el sistema del negocio para responder con datos reales: estado de un pedido, estado de una reparación, precio y disponibilidad de un producto, o si la persona ya es cliente. Usalo SIEMPRE antes de decir un estado, un precio o una fecha. Nunca inventes esos datos.",
  parametros: {
    type: "object",
    properties: {
      operacion: {
        type: "string",
        enum: ["pedido", "reparacion", "catalogo", "cliente"],
        description: "Qué querés consultar",
      },
      identificador: {
        type: "string",
        description:
          "Número de pedido o de reparación (para 'pedido' y 'reparacion'), o qué busca la persona (para 'catalogo'). Vacío para 'cliente'.",
      },
    },
    required: ["operacion"],
  },

  async ejecutar(args, ctx) {
    const sistema = sistemaExterno();
    if (!sistema) return "No hay un sistema externo configurado en este CRM.";

    const operacion = String(args.operacion ?? "");
    const identificador = String(args.identificador ?? "").trim();

    // Resolvemos el cliente por teléfono para no mostrarle a una persona los datos de
    // otra. En Instagram y Messenger no hay teléfono: ahí el pedido se consulta igual
    // pero conviene pedir un dato más antes de dar información sensible.
    let clienteId: string | null = null;
    if (sistema.buscarCliente && ctx.telefono) {
      const cliente = await llamarSistema(
        "buscarCliente",
        () => sistema.buscarCliente!({ telefono: ctx.telefono }),
        { conversationId: ctx.conversationId },
      );
      if (cliente.ok && cliente.data) clienteId = cliente.data.id;
    }

    switch (operacion) {
      case "cliente": {
        if (!sistema.buscarCliente) return "Este sistema no permite buscar clientes.";
        if (!clienteId) return "No encontré a esta persona en el sistema como cliente.";
        return `La persona ya figura como cliente (id ${clienteId}).`;
      }

      case "pedido": {
        if (!sistema.consultarPedido) return "Este sistema no permite consultar pedidos.";
        if (!identificador) return "Falta el número de pedido: pedíselo a la persona.";
        const res = await llamarSistema(
          "consultarPedido",
          () => sistema.consultarPedido!(identificador, clienteId),
          { conversationId: ctx.conversationId },
        );
        if (!res.ok) return `No pude consultar el pedido ahora: ${res.error}`;
        if (!res.data) {
          return "No encontré ese número de pedido asociado a esta persona. Pedile que lo verifique.";
        }
        return JSON.stringify(res.data);
      }

      case "reparacion": {
        if (!sistema.consultarReparacion) return "Este sistema no permite consultar reparaciones.";
        if (!identificador) return "Falta el número de reparación: pedíselo a la persona.";
        const res = await llamarSistema(
          "consultarReparacion",
          () => sistema.consultarReparacion!(identificador, clienteId),
          { conversationId: ctx.conversationId },
        );
        if (!res.ok) return `No pude consultar la reparación ahora: ${res.error}`;
        if (!res.data) {
          return "No encontré ese número de reparación asociado a esta persona. Pedile que lo verifique.";
        }
        return JSON.stringify(res.data);
      }

      case "catalogo": {
        if (!sistema.buscarEnCatalogo) return "Este sistema no permite consultar el catálogo.";
        const res = await llamarSistema(
          "buscarEnCatalogo",
          () => sistema.buscarEnCatalogo!(identificador),
          { conversationId: ctx.conversationId },
        );
        if (!res.ok) return `No pude consultar el catálogo ahora: ${res.error}`;
        if (res.data.length === 0) return "No encontré nada con esa descripción en el catálogo.";
        return JSON.stringify(res.data);
      }

      default:
        return "Operación desconocida.";
    }
  },
};
