ALTER TABLE "reservas"
  ADD COLUMN "checkInSaldoPendienteAutorizadoEn" TIMESTAMP(3),
  ADD COLUMN "checkInSaldoPendienteAutorizadoPorId" TEXT,
  ADD COLUMN "checkInSaldoPendienteMotivo" TEXT;
