export interface ContextoHerramienta {
  conversationId: string;
  contactId: string | null;
  channel: string;
  /** Teléfono del contacto, si el canal lo da. En Instagram y Messenger es null. */
  telefono: string | null;
}

export interface Herramienta {
  nombre: string;
  descripcion: string;
  /** JSON Schema de los parámetros, tal como lo espera el modelo. */
  parametros: Record<string, unknown>;
  /** Devuelve texto que vuelve al modelo. Nunca tira: los errores se explican. */
  ejecutar(args: Record<string, unknown>, ctx: ContextoHerramienta): Promise<string>;
}
