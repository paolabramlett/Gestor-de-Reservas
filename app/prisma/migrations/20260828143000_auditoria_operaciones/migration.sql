CREATE TABLE "public"."auditoria_operaciones" (
    "id" TEXT NOT NULL,
    "propiedadId" TEXT NOT NULL,
    "actorUsuarioId" TEXT,
    "reservaId" TEXT,
    "grupoId" TEXT,
    "accion" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "rol" "public"."RolUsuario",
    "importeAnteriorMxn" DECIMAL(10,2),
    "importeNuevoMxn" DECIMAL(10,2),
    "motivo" TEXT,
    "idempotencyKey" TEXT,
    "stripeId" TEXT,
    "metadata" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auditoria_operaciones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auditoria_operaciones_propiedadId_creadoEn_idx"
  ON "public"."auditoria_operaciones"("propiedadId", "creadoEn");
CREATE INDEX "auditoria_operaciones_reservaId_creadoEn_idx"
  ON "public"."auditoria_operaciones"("reservaId", "creadoEn");
CREATE INDEX "auditoria_operaciones_grupoId_creadoEn_idx"
  ON "public"."auditoria_operaciones"("grupoId", "creadoEn");

ALTER TABLE "public"."auditoria_operaciones"
  ADD CONSTRAINT "auditoria_operaciones_propiedadId_fkey"
  FOREIGN KEY ("propiedadId") REFERENCES "public"."propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."auditoria_operaciones"
  ADD CONSTRAINT "auditoria_operaciones_actorUsuarioId_fkey"
  FOREIGN KEY ("actorUsuarioId") REFERENCES "public"."usuarios_propiedad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."auditoria_operaciones"
  ADD CONSTRAINT "auditoria_operaciones_reservaId_fkey"
  FOREIGN KEY ("reservaId") REFERENCES "public"."reservas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."auditoria_operaciones"
  ADD CONSTRAINT "auditoria_operaciones_grupoId_fkey"
  FOREIGN KEY ("grupoId") REFERENCES "public"."grupos_reserva"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- El historial es append-only para los roles de aplicación. Prisma usa la
-- conexión del servidor y sigue aplicando autorización por tenant/actor.
ALTER TABLE "public"."auditoria_operaciones" ENABLE ROW LEVEL SECURITY;
