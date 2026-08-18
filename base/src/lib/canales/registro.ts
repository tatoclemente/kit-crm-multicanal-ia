import type { ProveedorDeCanales } from "./tipos";
import * as bandeja from "./zernio/bandeja";
import * as cuentas from "./zernio/cuentas";
import { verificarFirma } from "./zernio/webhooks";

/**
 * Selección del proveedor. Hoy hay uno; el día que se agregue Meta Cloud API se escribe
 * otro módulo que cumpla ProveedorDeCanales y se lo agrega a este mapa. Nada más del
 * CRM cambia: por eso `provider` es una columna propia y no está mezclada con `channel`.
 */
const zernio: ProveedorDeCanales = {
  nombre: "zernio",
  listarCuentas: cuentas.listarCuentas,
  listarConversaciones: bandeja.listarConversaciones,
  listarMensajes: bandeja.listarMensajes,
  enviarMensaje: bandeja.enviarMensaje,
  abrirConversacion: bandeja.abrirConversacion,
  verificarFirma,
};

const proveedores: Record<string, ProveedorDeCanales> = { zernio };

export function proveedor(nombre = "zernio"): ProveedorDeCanales {
  const p = proveedores[nombre];
  if (!p) throw new Error(`Proveedor desconocido: ${nombre}`);
  return p;
}
