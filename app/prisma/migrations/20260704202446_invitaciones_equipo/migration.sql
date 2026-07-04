-- CreateTable
CREATE TABLE "invitaciones_equipo" (
    "id" TEXT NOT NULL,
    "propiedadId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "token" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "aceptadaEn" TIMESTAMP(3),
    "canceladaEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitaciones_equipo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitaciones_equipo_token_key" ON "invitaciones_equipo"("token");

-- CreateIndex
CREATE INDEX "invitaciones_equipo_propiedadId_idx" ON "invitaciones_equipo"("propiedadId");

-- AddForeignKey
ALTER TABLE "invitaciones_equipo" ADD CONSTRAINT "invitaciones_equipo_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;
