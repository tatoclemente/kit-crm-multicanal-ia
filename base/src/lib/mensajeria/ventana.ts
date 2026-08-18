import type { Canal } from "@db/esquema";

/**
 * La ventana de 24 horas de Meta la decide el SERVIDOR, no la interfaz.
 *
 * Si el botón "enviar" se habilita en el navegador, tarde o temprano manda algo que
 * rebota: el cliente queda esperando y el vendedor cree que contestó. Es la peor
 * experiencia posible, y no deja rastro de error.
 */
export type EstadoVentana =
  | { abierta: true; venceEn: Date }
  | { abierta: false; motivo: string; alternativa: Alternativa };

export type Alternativa =
  | { tipo: "plantilla"; detalle: string }
  | { tipo: "etiqueta-humana"; detalle: string; venceEn: Date }
  | { tipo: "ninguna"; detalle: string };

const HORAS_24 = 24 * 60 * 60 * 1000;
const DIAS_7 = 7 * 24 * 60 * 60 * 1000;

export function estadoDeVentana(
  canal: Canal,
  ultimoEntranteEn: Date | null,
  ahora = new Date(),
): EstadoVentana {
  if (!ultimoEntranteEn) {
    return {
      abierta: false,
      motivo: "Esta persona todavía no escribió: no hay ventana abierta.",
      alternativa:
        canal === "whatsapp"
          ? { tipo: "plantilla", detalle: "Solo se puede iniciar con una plantilla aprobada." }
          : { tipo: "ninguna", detalle: "En esta red no se puede iniciar la conversación." },
    };
  }

  const vence = new Date(ultimoEntranteEn.getTime() + HORAS_24);
  if (ahora < vence) return { abierta: true, venceEn: vence };

  if (canal === "whatsapp") {
    return {
      abierta: false,
      motivo: `Pasaron más de 24 horas desde el último mensaje de la persona (${ultimoEntranteEn.toISOString()}).`,
      alternativa: {
        tipo: "plantilla",
        detalle:
          "Fuera de ventana WhatsApp solo admite plantilla aprobada, o un envío de utilidad que Meta aprueba después.",
      },
    };
  }

  // Instagram y Messenger: texto libre con la etiqueta de agente humano hasta 7 días.
  const venceEtiqueta = new Date(ultimoEntranteEn.getTime() + DIAS_7);
  if (ahora < venceEtiqueta) {
    return {
      abierta: false,
      motivo: "Pasaron más de 24 horas desde el último mensaje de la persona.",
      alternativa: {
        tipo: "etiqueta-humana",
        detalle: "Se puede responder como agente humano hasta 7 días después del último mensaje.",
        venceEn: venceEtiqueta,
      },
    };
  }

  return {
    abierta: false,
    motivo: "Pasaron más de 7 días desde el último mensaje de la persona.",
    alternativa: { tipo: "ninguna", detalle: "Hay que esperar a que la persona vuelva a escribir." },
  };
}

/** El agente NUNCA escribe fuera de ventana: eso lo decide una persona. */
export function elAgentePuedeResponder(estado: EstadoVentana): boolean {
  return estado.abierta === true;
}
