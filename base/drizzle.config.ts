import type { Config } from "drizzle-kit";

export default {
  schema: "./db/esquema.ts",
  out: "./db/migraciones",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config;
