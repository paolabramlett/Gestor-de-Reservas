-- AlterTable
ALTER TABLE "reservas" ADD COLUMN     "documentoNumero" TEXT,
ADD COLUMN     "documentoTipo" TEXT,
ADD COLUMN     "nacionalidad" TEXT,
ADD COLUMN     "placasVehiculo" TEXT,
ADD COLUMN     "politicasAceptadas" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "politicasAceptadasEn" TIMESTAMP(3),
ADD COLUMN     "registroCheckInEn" TIMESTAMP(3);
