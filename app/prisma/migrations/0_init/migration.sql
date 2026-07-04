-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ModalidadTarifa" AS ENUM ('POR_PERSONA', 'POR_HABITACION', 'BASE_MAS_SUPLEMENTO');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('PENDIENTE_PAGO', 'CONFIRMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "OrigenReserva" AS ENUM ('ONLINE', 'MANUAL');

-- CreateEnum
CREATE TYPE "EstadoDePago" AS ENUM ('PENDIENTE', 'ANTICIPO_PAGADO', 'PAGADO_COMPLETO');

-- CreateEnum
CREATE TYPE "TipoEspecialReserva" AS ENUM ('CORTESIA', 'PRECIO_ACORDADO', 'PROMOCION');

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'RESERVACIONES', 'FINANZAS', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "PlanRoomly" AS ENUM ('ESENCIAL', 'PRO');

-- CreateEnum
CREATE TYPE "EstadoCambio" AS ENUM ('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'EXPIRADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "propiedades" (
    "id" TEXT NOT NULL,
    "clerkOrgId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "logoUrl" TEXT,
    "colorPrimario" TEXT,
    "colorSecundario" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "planActivo" "PlanRoomly" NOT NULL DEFAULT 'ESENCIAL',
    "suscripcionActiva" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "propiedades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_propiedad" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "propiedadId" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_propiedad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_de_habitacion" (
    "id" TEXT NOT NULL,
    "propiedadId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "capacidadMin" INTEGER NOT NULL,
    "capacidadMax" INTEGER NOT NULL,
    "fotos" TEXT[],
    "amenidades" TEXT[],
    "tarifaBasePrice" DECIMAL(10,2) NOT NULL,
    "tarifaBaseModalidad" "ModalidadTarifa" NOT NULL,
    "suplementoPorPersona" DECIMAL(10,2),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "icalToken" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_de_habitacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habitaciones" (
    "id" TEXT NOT NULL,
    "propiedadId" TEXT NOT NULL,
    "tipoDeHabitacionId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "habitaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "temporadas" (
    "id" TEXT NOT NULL,
    "propiedadId" TEXT NOT NULL,
    "tipoDeHabitacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "modalidad" "ModalidadTarifa" NOT NULL,
    "suplementoPorPersona" DECIMAL(10,2),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "temporadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "huespedes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "huespedes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupos_reserva" (
    "id" TEXT NOT NULL,
    "propiedadId" TEXT NOT NULL,
    "codigoGrupo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "notas" TEXT,
    "totalPagado" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "stripePaymentIntentId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grupos_reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas" (
    "id" TEXT NOT NULL,
    "codigoReserva" TEXT NOT NULL,
    "propiedadId" TEXT NOT NULL,
    "tipoDeHabitacionId" TEXT NOT NULL,
    "huespedId" TEXT NOT NULL,
    "grupoId" TEXT,
    "origen" "OrigenReserva" NOT NULL,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'CONFIRMADA',
    "fechaIngreso" DATE NOT NULL,
    "fechaSalida" DATE NOT NULL,
    "numPersonas" INTEGER NOT NULL,
    "nombreHuesped" TEXT NOT NULL DEFAULT '',
    "totalMxn" DECIMAL(10,2) NOT NULL,
    "desglosePorNoche" JSONB NOT NULL,
    "stripePaymentIntentId" TEXT,
    "stripeCheckoutSessionId" TEXT,
    "linkExpiraEn" TIMESTAMP(3),
    "tipoEspecial" "TipoEspecialReserva",
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignaciones_de_habitacion" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "habitacionId" TEXT NOT NULL,
    "asignadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asignaciones_de_habitacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos_manuales" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "estadoDePago" "EstadoDePago" NOT NULL DEFAULT 'PENDIENTE',
    "montoAnticipo" DECIMAL(10,2),
    "notas" TEXT,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pagos_manuales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitudes_cambio" (
    "id" TEXT NOT NULL,
    "reservaId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "fechaIngresoNueva" DATE NOT NULL,
    "fechaSalidaNueva" DATE NOT NULL,
    "totalActual" DECIMAL(10,2) NOT NULL,
    "totalNuevo" DECIMAL(10,2) NOT NULL,
    "diferencia" DECIMAL(10,2) NOT NULL,
    "estado" "EstadoCambio" NOT NULL DEFAULT 'PENDIENTE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitudes_cambio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloqueos_de_habitacion" (
    "id" TEXT NOT NULL,
    "habitacionId" TEXT NOT NULL,
    "propiedadId" TEXT NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE NOT NULL,
    "motivo" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bloqueos_de_habitacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloqueos_de_tipo" (
    "id" TEXT NOT NULL,
    "tipoDeHabitacionId" TEXT NOT NULL,
    "propiedadId" TEXT NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE NOT NULL,
    "motivo" TEXT,
    "icalFeedId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bloqueos_de_tipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ical_feeds" (
    "id" TEXT NOT NULL,
    "propiedadId" TEXT NOT NULL,
    "tipoDeHabitacionId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ical_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "propiedades_clerkOrgId_key" ON "propiedades"("clerkOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "propiedades_slug_key" ON "propiedades"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_propiedad_clerkUserId_propiedadId_key" ON "usuarios_propiedad"("clerkUserId", "propiedadId");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_de_habitacion_icalToken_key" ON "tipos_de_habitacion"("icalToken");

-- CreateIndex
CREATE UNIQUE INDEX "habitaciones_propiedadId_numero_key" ON "habitaciones"("propiedadId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "grupos_reserva_codigoGrupo_key" ON "grupos_reserva"("codigoGrupo");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_codigoReserva_key" ON "reservas"("codigoReserva");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_stripePaymentIntentId_key" ON "reservas"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_stripeCheckoutSessionId_key" ON "reservas"("stripeCheckoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "asignaciones_de_habitacion_reservaId_key" ON "asignaciones_de_habitacion"("reservaId");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_manuales_reservaId_key" ON "pagos_manuales"("reservaId");

-- CreateIndex
CREATE UNIQUE INDEX "solicitudes_cambio_token_key" ON "solicitudes_cambio"("token");

-- AddForeignKey
ALTER TABLE "usuarios_propiedad" ADD CONSTRAINT "usuarios_propiedad_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tipos_de_habitacion" ADD CONSTRAINT "tipos_de_habitacion_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habitaciones" ADD CONSTRAINT "habitaciones_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habitaciones" ADD CONSTRAINT "habitaciones_tipoDeHabitacionId_fkey" FOREIGN KEY ("tipoDeHabitacionId") REFERENCES "tipos_de_habitacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temporadas" ADD CONSTRAINT "temporadas_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "temporadas" ADD CONSTRAINT "temporadas_tipoDeHabitacionId_fkey" FOREIGN KEY ("tipoDeHabitacionId") REFERENCES "tipos_de_habitacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupos_reserva" ADD CONSTRAINT "grupos_reserva_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_propiedadId_fkey" FOREIGN KEY ("propiedadId") REFERENCES "propiedades"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_tipoDeHabitacionId_fkey" FOREIGN KEY ("tipoDeHabitacionId") REFERENCES "tipos_de_habitacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_huespedId_fkey" FOREIGN KEY ("huespedId") REFERENCES "huespedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "grupos_reserva"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_de_habitacion" ADD CONSTRAINT "asignaciones_de_habitacion_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "reservas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_de_habitacion" ADD CONSTRAINT "asignaciones_de_habitacion_habitacionId_fkey" FOREIGN KEY ("habitacionId") REFERENCES "habitaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos_manuales" ADD CONSTRAINT "pagos_manuales_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "reservas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_cambio" ADD CONSTRAINT "solicitudes_cambio_reservaId_fkey" FOREIGN KEY ("reservaId") REFERENCES "reservas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueos_de_habitacion" ADD CONSTRAINT "bloqueos_de_habitacion_habitacionId_fkey" FOREIGN KEY ("habitacionId") REFERENCES "habitaciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueos_de_tipo" ADD CONSTRAINT "bloqueos_de_tipo_tipoDeHabitacionId_fkey" FOREIGN KEY ("tipoDeHabitacionId") REFERENCES "tipos_de_habitacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloqueos_de_tipo" ADD CONSTRAINT "bloqueos_de_tipo_icalFeedId_fkey" FOREIGN KEY ("icalFeedId") REFERENCES "ical_feeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ical_feeds" ADD CONSTRAINT "ical_feeds_tipoDeHabitacionId_fkey" FOREIGN KEY ("tipoDeHabitacionId") REFERENCES "tipos_de_habitacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
