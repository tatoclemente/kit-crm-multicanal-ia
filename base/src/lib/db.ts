import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as esquema from "@db/esquema";
import { entorno } from "./entorno";

/**
 * `prepare: false` es obligatorio detrás del pooler de Supabase (pgbouncer en modo
 * transaction): sin esto, las sentencias preparadas de postgres.js chocan con cómo
 * pgbouncer reparte las conexiones.
 *
 * El tamaño del pool SÍ cambia según el entorno:
 *
 * - En producción (Vercel), `max: 1`. Cada invocación de la función es efímera: una
 *   sola conexión por invocación es lo correcto y lo que evita agotar el límite de
 *   conexiones del proyecto cuando hay miles de invocaciones concurrentes.
 *
 * - En desarrollo, `next dev` es un proceso ÚNICO Y PERSISTENTE que puede recibir
 *   pedidos superpuestos (el propio modo de desarrollo de Next a veces invoca una
 *   ruta más de una vez). Con `max: 1` ahí, un pedido que todavía está en su `after()`
 *   deja sin conexión a cualquier otro pedido que llegue mientras tanto: se pone en
 *   cola y espera a que el pooler de Supabase reponga la conexión, lo que puede tardar
 *   varios minutos. No es un error del esquema ni del webhook: es este pool
 *   compartido, mal dimensionado para un servidor persistente.
 */
const cliente = postgres(entorno.DATABASE_URL, {
  prepare: false,
  max: process.env.NODE_ENV === "production" ? 1 : 5,
});

export const db = drizzle(cliente, { schema: esquema });
export { esquema };
