-- AlterTable
ALTER TABLE "huespedes" ADD COLUMN     "propiedadId" TEXT;

-- CreateTable
CREATE TABLE "stripe_eventos_procesados" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "procesadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_eventos_procesados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "huespedes_email_propiedadId_idx" ON "huespedes"("email", "propiedadId");
