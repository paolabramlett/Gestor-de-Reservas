CREATE TYPE "EstadoIntentoDePagoStripe" AS ENUM ('PENDIENTE', 'PAGADO', 'CANCELADO');

CREATE TABLE "intentos_de_pago_stripe" (
  "id" TEXT NOT NULL,
  "intentoId" TEXT NOT NULL,
  "propiedadId" TEXT NOT NULL,
  "stripeConnectAccountId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "montoCentavos" INTEGER NOT NULL,
  "moneda" TEXT NOT NULL DEFAULT 'mxn',
  "datosReserva" JSONB NOT NULL,
  "estado" "EstadoIntentoDePagoStripe" NOT NULL DEFAULT 'PENDIENTE',
  "stripePaymentIntentId" TEXT,
  "stripeCheckoutSessionId" TEXT,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizadoEn" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "intentos_de_pago_stripe_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "intentos_pago_monto_positivo" CHECK ("montoCentavos" > 0),
  CONSTRAINT "intentos_pago_moneda_mxn" CHECK (lower("moneda") = 'mxn')
);

CREATE UNIQUE INDEX "intentos_de_pago_stripe_intentoId_key" ON "intentos_de_pago_stripe"("intentoId");
CREATE UNIQUE INDEX "intentos_de_pago_stripe_stripePaymentIntentId_key" ON "intentos_de_pago_stripe"("stripePaymentIntentId");
CREATE UNIQUE INDEX "intentos_de_pago_stripe_stripeCheckoutSessionId_key" ON "intentos_de_pago_stripe"("stripeCheckoutSessionId");
CREATE INDEX "intentos_de_pago_stripe_propiedadId_estado_idx" ON "intentos_de_pago_stripe"("propiedadId", "estado");

ALTER TABLE "intentos_de_pago_stripe"
  ADD CONSTRAINT "intentos_de_pago_stripe_propiedadId_fkey"
  FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "intentos_pago_proteger_autorizacion"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."intentoId" IS DISTINCT FROM OLD."intentoId"
     OR NEW."propiedadId" IS DISTINCT FROM OLD."propiedadId"
     OR NEW."stripeConnectAccountId" IS DISTINCT FROM OLD."stripeConnectAccountId"
     OR NEW."tipo" IS DISTINCT FROM OLD."tipo"
     OR NEW."montoCentavos" IS DISTINCT FROM OLD."montoCentavos"
     OR NEW."moneda" IS DISTINCT FROM OLD."moneda"
     OR NEW."datosReserva" IS DISTINCT FROM OLD."datosReserva"
     OR (OLD."stripePaymentIntentId" IS NOT NULL AND NEW."stripePaymentIntentId" IS DISTINCT FROM OLD."stripePaymentIntentId")
     OR (OLD."stripeCheckoutSessionId" IS NOT NULL AND NEW."stripeCheckoutSessionId" IS DISTINCT FROM OLD."stripeCheckoutSessionId") THEN
    RAISE EXCEPTION 'La autorización financiera de un intento de pago es inmutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "intentos_pago_autorizacion_inmutable"
BEFORE UPDATE ON "intentos_de_pago_stripe"
FOR EACH ROW EXECUTE FUNCTION "intentos_pago_proteger_autorizacion"();
