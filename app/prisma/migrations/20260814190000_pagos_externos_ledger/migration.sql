CREATE TYPE "MetodoPagoExterno" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TERMINAL_EXTERNA', 'OTRO');
CREATE TYPE "TipoAjustePagoExterno" AS ENUM ('ANULACION', 'REEMBOLSO');
CREATE TYPE "EstadoComprobantePago" AS ENUM ('NO_SOLICITADO', 'PENDIENTE', 'ENVIADO', 'FALLIDO');

CREATE TABLE "pagos_externos" (
  "id" TEXT NOT NULL,
  "propiedadId" TEXT NOT NULL,
  "reservaId" TEXT NOT NULL,
  "montoMxn" DECIMAL(10,2) NOT NULL,
  "metodo" "MetodoPagoExterno" NOT NULL,
  "fechaPago" TIMESTAMP(3) NOT NULL,
  "nota" TEXT,
  "creadoPorUsuarioId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "reemplazaPagoExternoId" TEXT,
  "estadoComprobante" "EstadoComprobantePago" NOT NULL DEFAULT 'NO_SOLICITADO',
  "comprobanteEnviadoEn" TIMESTAMP(3),
  "comprobanteError" TEXT,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pagos_externos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pagos_externos_monto_positivo" CHECK ("montoMxn" > 0)
);

CREATE TABLE "ajustes_pagos_externos" (
  "id" TEXT NOT NULL,
  "pagoExternoId" TEXT NOT NULL,
  "tipo" "TipoAjustePagoExterno" NOT NULL,
  "montoMxn" DECIMAL(10,2) NOT NULL,
  "motivo" TEXT NOT NULL,
  "creadoPorUsuarioId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ajustes_pagos_externos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ajustes_pagos_externos_monto_positivo" CHECK ("montoMxn" > 0)
);

CREATE UNIQUE INDEX "pagos_externos_idempotencyKey_key" ON "pagos_externos"("idempotencyKey");
CREATE INDEX "pagos_externos_reservaId_creadoEn_idx" ON "pagos_externos"("reservaId", "creadoEn");
CREATE INDEX "pagos_externos_propiedadId_fechaPago_idx" ON "pagos_externos"("propiedadId", "fechaPago");

CREATE UNIQUE INDEX "ajustes_pagos_externos_idempotencyKey_key" ON "ajustes_pagos_externos"("idempotencyKey");
CREATE INDEX "ajustes_pagos_externos_pagoExternoId_creadoEn_idx" ON "ajustes_pagos_externos"("pagoExternoId", "creadoEn");

ALTER TABLE "pagos_externos"
  ADD CONSTRAINT "pagos_externos_propiedadId_fkey"
  FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pagos_externos"
  ADD CONSTRAINT "pagos_externos_reservaId_fkey"
  FOREIGN KEY ("reservaId") REFERENCES "reservas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pagos_externos"
  ADD CONSTRAINT "pagos_externos_creadoPorUsuarioId_fkey"
  FOREIGN KEY ("creadoPorUsuarioId") REFERENCES "usuarios_propiedad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pagos_externos"
  ADD CONSTRAINT "pagos_externos_reemplazaPagoExternoId_fkey"
  FOREIGN KEY ("reemplazaPagoExternoId") REFERENCES "pagos_externos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ajustes_pagos_externos"
  ADD CONSTRAINT "ajustes_pagos_externos_pagoExternoId_fkey"
  FOREIGN KEY ("pagoExternoId") REFERENCES "pagos_externos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ajustes_pagos_externos"
  ADD CONSTRAINT "ajustes_pagos_externos_creadoPorUsuarioId_fkey"
  FOREIGN KEY ("creadoPorUsuarioId") REFERENCES "usuarios_propiedad"("id") ON DELETE SET NULL ON UPDATE CASCADE;
