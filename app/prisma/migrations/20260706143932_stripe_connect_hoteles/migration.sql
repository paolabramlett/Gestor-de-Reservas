-- AlterTable
ALTER TABLE "propiedades" ADD COLUMN "stripeConnectAccountId" TEXT,
ADD COLUMN "stripeConnectHabilitado" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "propiedades_stripeConnectAccountId_key" ON "propiedades"("stripeConnectAccountId");
