import { config } from "dotenv";
// Respeta DATABASE_URL/DIRECT_URL explícitas para poder migrar bases aisladas
// de pruebas; .env.local sigue siendo el fallback del desarrollo local.
config({ path: ".env.local", override: false });
import { defineConfig } from "prisma/config";

// Supabase pooler puerto 5432 = session mode, soporta DDL para migraciones.
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL!;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: migrationUrl,
  },
});
