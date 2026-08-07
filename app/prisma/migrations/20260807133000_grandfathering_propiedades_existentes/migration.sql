ALTER TABLE "propiedades"
ADD COLUMN "accesoGratisLegacy" BOOLEAN NOT NULL DEFAULT false;

-- El corte ocurre al aplicar esta migración: únicamente las propiedades que
-- ya existen conservan acceso sin cuota. Las altas posteriores reciben el
-- DEFAULT false y deben completar la suscripción oficial.
UPDATE "propiedades"
SET "accesoGratisLegacy" = true;
