import datos from "./datos.json";
import type {
  ArticuloCatalogo,
  ClienteExterno,
  PedidoExterno,
  ReparacionExterna,
  RespuestaSistema,
  SistemaExterno,
  TicketNuevo,
} from "../tipos";

/**
 * Adaptador de EJEMPLO: una tienda con servicio técnico. Los datos son ficticios y
 * viven en datos.json, así que funciona sin credenciales y sin red.
 *
 * Copiá este archivo como plantilla para el sistema real de tu cliente:
 * cambiás el cuerpo de cada método por una llamada HTTP y listo. Lo que NO cambia es
 * el contrato ni las tres reglas de `../tipos.ts`.
 *
 * Fijate especialmente en `recortar...`: el sistema tiene más campos de los que
 * devolvemos. Lo que no llega al modelo no se puede filtrar en un mensaje.
 */
const tickets: { id: string; ticket: TicketNuevo }[] = [];

export const sistemaEjemplo: SistemaExterno = {
  nombre: "ejemplo-tienda-servicio",

  async buscarCliente(criterio): Promise<RespuestaSistema<ClienteExterno | null>> {
    const telefono = normalizar(criterio.telefono);
    const email = criterio.email?.trim().toLowerCase() ?? null;

    const encontrado = datos.clientes.find(
      (c) =>
        (telefono !== null && normalizar(c.telefono) === telefono) ||
        (email !== null && c.email?.toLowerCase() === email),
    );

    if (!encontrado) return { ok: true, data: null };
    return {
      ok: true,
      data: { id: encontrado.id, nombre: encontrado.nombre, etiquetas: encontrado.etiquetas },
    };
  },

  async consultarPedido(identificador, clienteId): Promise<RespuestaSistema<PedidoExterno | null>> {
    const id = identificador.trim().toUpperCase();
    const pedido = datos.pedidos.find((p) => p.id.toUpperCase() === id);
    if (!pedido) return { ok: true, data: null };

    // Un pedido solo se muestra a quien lo hizo. Sin esto, cualquiera que tipee
    // PED-4471 se entera de lo que compró otra persona.
    if (clienteId && pedido.clienteId !== clienteId) return { ok: true, data: null };

    return {
      ok: true,
      data: {
        id: pedido.id,
        estado: pedido.estado,
        fecha: pedido.fecha,
        total: pedido.total,
        moneda: pedido.moneda,
        detalle: pedido.detalle,
        seguimientoUrl: pedido.seguimientoUrl,
      },
    };
  },

  async consultarReparacion(
    identificador,
    clienteId,
  ): Promise<RespuestaSistema<ReparacionExterna | null>> {
    const id = identificador.trim().toUpperCase();
    const rep = datos.reparaciones.find((r) => r.id.toUpperCase() === id);
    if (!rep) return { ok: true, data: null };
    if (clienteId && rep.clienteId !== clienteId) return { ok: true, data: null };

    return {
      ok: true,
      data: {
        id: rep.id,
        equipo: rep.equipo,
        estado: rep.estado,
        ingresadoEl: rep.ingresadoEl,
        estimadoPara: rep.estimadoPara,
        presupuesto: rep.presupuesto,
        observaciones: rep.observaciones,
      },
    };
  },

  async buscarEnCatalogo(texto, limite = 5): Promise<RespuestaSistema<ArticuloCatalogo[]>> {
    const busqueda = texto.trim().toLowerCase();
    if (!busqueda) return { ok: true, data: [] };

    const encontrados = datos.catalogo
      .filter((a) => a.nombre.toLowerCase().includes(busqueda))
      .slice(0, limite);

    return { ok: true, data: encontrados };
  },

  async crearTicket(ticket): Promise<RespuestaSistema<{ id: string }>> {
    const id = `TCK-${String(tickets.length + 1).padStart(4, "0")}`;
    tickets.push({ id, ticket });
    return { ok: true, data: { id } };
  },
};

function normalizar(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const soloDigitos = valor.replace(/\D/g, "");
  return soloDigitos.length >= 8 ? soloDigitos : null;
}
