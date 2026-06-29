import { config } from "dotenv";
config({ path: ".env.local", override: true });
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
