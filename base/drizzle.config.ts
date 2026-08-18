import type { Config } from "drizzle-kit";

// drizzle-kit tampoco lee .env.local solo. Lo cargamos acá para que `npm run db:generate`
// y `npm run db:migrate` funcionen sin tener que exportar DATABASE_URL a mano.
// Si el archivo no existe, seguimos: las variables pueden venir del entorno.
try {
  process.loadEnvFile(".env.local");
} catch {
  /* sin .env.local: se usan las variables del entorno */
}

export default {
  schema: "./db/esquema.ts",
  out: "./db/migraciones",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config;
