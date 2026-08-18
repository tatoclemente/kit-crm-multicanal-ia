import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as esquema from "@db/esquema";
import { entorno } from "./entorno";

/**
 * En serverless cada invocación puede abrir su propia conexión. `prepare: false` es
 * obligatorio detrás del pooler de Supabase (pgbouncer en modo transaction).
 */
const cliente = postgres(entorno.DATABASE_URL, { prepare: false, max: 1 });

export const db = drizzle(cliente, { schema: esquema });
export { esquema };
