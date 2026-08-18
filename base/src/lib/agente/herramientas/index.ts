import { calificar } from "./calificar";
import { consultarSistema } from "./consultar-sistema";
import { derivar } from "./derivar";
import type { Herramienta } from "./tipos";

/**
 * Registro de herramientas. Para agregar una nueva: escribí el archivo, importalo acá
 * y agregalo al mapa. Después prendela en la pantalla de ajustes del canal
 * (agent_configs.enabled_tools): registrada no significa activa.
 */
const todas: Record<string, Herramienta> = {
  [calificar.nombre]: calificar,
  [derivar.nombre]: derivar,
  [consultarSistema.nombre]: consultarSistema,
};

/** Las que arrancan prendidas si el canal no define otra cosa. */
export const HERRAMIENTAS_POR_DEFECTO = [calificar.nombre, derivar.nombre];

export function herramientasHabilitadas(nombres: string[]): Herramienta[] {
  const elegidas = nombres.length > 0 ? nombres : HERRAMIENTAS_POR_DEFECTO;
  return elegidas.map((n) => todas[n]).filter((h): h is Herramienta => h !== undefined);
}

export function catalogoDeHerramientas(): string[] {
  return Object.keys(todas);
}

export type { Herramienta, ContextoHerramienta } from "./tipos";
