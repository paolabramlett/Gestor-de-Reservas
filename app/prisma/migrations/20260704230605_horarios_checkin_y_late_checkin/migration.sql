-- AlterTable
ALTER TABLE "propiedades" ADD COLUMN     "costoLateCheckIn" DECIMAL(10,2),
ADD COLUMN     "horaCheckIn" TEXT NOT NULL DEFAULT '15:00',
ADD COLUMN     "horaCheckOut" TEXT NOT NULL DEFAULT '12:00',
ADD COLUMN     "horasParaLateCheckIn" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "horasParaNoShow" INTEGER NOT NULL DEFAULT 6;

-- AlterTable
ALTER TABLE "reservas" ADD COLUMN     "cargoLateCheckIn" DECIMAL(10,2),
ADD COLUMN     "lateCheckInEn" TIMESTAMP(3);
