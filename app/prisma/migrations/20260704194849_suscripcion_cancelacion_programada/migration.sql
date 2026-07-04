-- AlterTable
ALTER TABLE "propiedades" ADD COLUMN     "canceladaAlFinalDePeriodo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "finDePeriodoActual" TIMESTAMP(3);
