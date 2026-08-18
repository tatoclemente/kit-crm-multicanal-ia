/**
 * Adaptador hacia el sistema que el cliente YA usa: una tienda, un sistema de servicio
 * técnico, un ERP, un sistema de turnos.
 *
 * La idea: escribís un solo archivo que cumpla esta interfaz contra la API real de ese
 * sistema, lo registrás, y el agente puede consultarlo durante la conversación en vez
 * de inventar. Nada más del CRM cambia.
 *
 * Reglas del adaptador:
 *
 * 1. NUNCA tira excepción. Devuelve `{ ok: false }` y el agente dice que no pudo
 *    consultar, en vez de que se caiga la respuesta entera.
 * 2. NUNCA devuelve más datos de los que el agente necesita decir. Si la API del
 *    cliente devuelve el costo interno, el margen o el teléfono de otro cliente, lo
 *    recortás acá. Lo que no llega al modelo no se puede filtrar en un mensaje.
 * 3. Es SOLO LECTURA salvo las operaciones declaradas como escritura, y toda escritura
 *    (crear un ticket, reservar) queda registrada en integration_calls.
 */
export type RespuestaSistema<T> = { ok: true; data: T } | { ok: false; error: string };

export interface ClienteExterno {
  id: string;
  nombre: string | null;
  /** Solo lo que el agente puede llegar a mencionar. Nada de datos internos. */
  etiquetas?: string[];
}

export interface PedidoExterno {
  id: string;
  estado: string;
  fecha: string | null;
  total: string | null;
  moneda: string | null;
  detalle: string | null;
  seguimientoUrl?: string | null;
}

export interface ReparacionExterna {
  id: string;
  equipo: string;
  estado: string;
  ingresadoEl: string | null;
  estimadoPara: string | null;
  presupuesto: string | null;
  observaciones: string | null;
}

export interface ArticuloCatalogo {
  id: string;
  nombre: string;
  precio: string | null;
  moneda: string | null;
  disponible: boolean;
  url?: string | null;
}

export interface TicketNuevo {
  clienteId: string | null;
  canal: string;
  asunto: string;
  detalle: string;
  telefono?: string | null;
}

/**
 * Lo que el agente puede pedirle al sistema externo. Implementá solo lo que el sistema
 * del cliente sepa hacer: lo que devuelvas `undefined` queda apagado y el agente no lo
 * ofrece.
 */
export interface SistemaExterno {
  readonly nombre: string;

  /** Busca al cliente por teléfono, mail o documento. */
  buscarCliente?(criterio: {
    telefono?: string | null;
    email?: string | null;
    documento?: string | null;
  }): Promise<RespuestaSistema<ClienteExterno | null>>;

  /** Estado de un pedido. El identificador lo da la persona en el chat. */
  consultarPedido?(
    identificador: string,
    clienteId?: string | null,
  ): Promise<RespuestaSistema<PedidoExterno | null>>;

  /** Estado de una reparación o servicio técnico. */
  consultarReparacion?(
    identificador: string,
    clienteId?: string | null,
  ): Promise<RespuestaSistema<ReparacionExterna | null>>;

  /** Búsqueda en el catálogo, con precio y disponibilidad reales. */
  buscarEnCatalogo?(
    texto: string,
    limite?: number,
  ): Promise<RespuestaSistema<ArticuloCatalogo[]>>;

  /** ESCRITURA: abre un ticket. Requiere confirmación de la persona en el chat. */
  crearTicket?(ticket: TicketNuevo): Promise<RespuestaSistema<{ id: string }>>;
}
