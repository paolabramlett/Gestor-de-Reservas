-- Preserve historical platform destination charges while recording the
-- immutable Connect account context required by newly-created direct charges.
CREATE TYPE "ModeloCobroStripe" AS ENUM ('DESTINATION_LEGACY', 'DIRECT');

ALTER TABLE "pagos_online"
  ADD COLUMN "modeloCobro" "ModeloCobroStripe" NOT NULL DEFAULT 'DESTINATION_LEGACY',
  ADD COLUMN "stripeConnectAccountId" TEXT;

ALTER TABLE "pagos_online"
  ADD CONSTRAINT "pagos_online_direct_account_check"
  CHECK (
    "modeloCobro" <> 'DIRECT'
    OR "stripeConnectAccountId" IS NOT NULL
  );

-- The owning account is part of the financial audit trail. It may be null for
-- legacy destination charges, but can never be changed after a payment exists.
CREATE FUNCTION "pagos_online_proteger_cuenta_connect"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."stripeConnectAccountId" IS DISTINCT FROM OLD."stripeConnectAccountId"
     OR NEW."modeloCobro" IS DISTINCT FROM OLD."modeloCobro" THEN
    RAISE EXCEPTION 'modeloCobro y stripeConnectAccountId son inmutables para pagos_online';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "pagos_online_contexto_stripe_inmutable"
BEFORE UPDATE OF "modeloCobro", "stripeConnectAccountId" ON "pagos_online"
FOR EACH ROW
EXECUTE FUNCTION "pagos_online_proteger_cuenta_connect"();
