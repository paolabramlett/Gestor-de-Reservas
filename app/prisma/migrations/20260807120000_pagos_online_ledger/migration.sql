CREATE TYPE "EstadoPagoOnline" AS ENUM ('PAGADO', 'REEMBOLSO_PENDIENTE', 'REEMBOLSADO_PARCIAL', 'REEMBOLSADO', 'REEMBOLSO_FALLIDO');

CREATE TABLE "pagos_online" (
  "id" TEXT NOT NULL,
  "propiedadId" TEXT NOT NULL,
  "reservaId" TEXT,
  "grupoId" TEXT,
  "stripePaymentIntentId" TEXT NOT NULL,
  "stripeCheckoutSessionId" TEXT,
  "montoMxn" DECIMAL(10,2) NOT NULL,
  "moneda" TEXT NOT NULL DEFAULT 'mxn',
  "estado" "EstadoPagoOnline" NOT NULL DEFAULT 'PAGADO',
  "montoReembolsadoMxn" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "reembolsoPendienteMxn" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pagos_online_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pagos_online_destino_check" CHECK (num_nonnulls("reservaId", "grupoId") = 1)
);

CREATE UNIQUE INDEX "pagos_online_stripePaymentIntentId_key" ON "pagos_online"("stripePaymentIntentId");
CREATE UNIQUE INDEX "pagos_online_stripeCheckoutSessionId_key" ON "pagos_online"("stripeCheckoutSessionId");
CREATE INDEX "pagos_online_propiedadId_creadoEn_idx" ON "pagos_online"("propiedadId", "creadoEn");
CREATE INDEX "pagos_online_reservaId_idx" ON "pagos_online"("reservaId");
CREATE INDEX "pagos_online_grupoId_idx" ON "pagos_online"("grupoId");

ALTER TABLE "pagos_online" ADD CONSTRAINT "pagos_online_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pagos_online" ADD CONSTRAINT "pagos_online_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "reservas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pagos_online" ADD CONSTRAINT "pagos_online_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "grupos_reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- No se hace backfill automático de PaymentIntents legacy: totalMxn y
-- totalPagado no prueban cuánto cobró un PaymentIntent concreto (puede ser un
-- anticipo o uno de varios pagos). Es más seguro reconciliarlos contra Stripe
-- antes de habilitar reembolsos automáticos que fabricar saldos financieros.
