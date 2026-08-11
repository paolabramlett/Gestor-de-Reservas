# Stripe Go-Live Checklist

## Puerta 1 — Ledger financiero

- Estado: APROBADA
- Fecha UTC: `2026-08-07T12:43:30Z`
- Commit desplegable: `c342e0689e7cf47a02cedbf79fd212abbecb9a78`
- Base: Supabase PostgreSQL actual, tratada como producción
- Modo Stripe configurado localmente: Test
- Migración aplicada: `20260807120000_pagos_online_ledger`
- Estado Prisma posterior: ocho migraciones aplicadas; esquema al día

### Respaldo previo

- Archivo: `/Users/paolabramlett/Downloads/roomly-database-backup-before-ledger-2026-08-07.tar.gz`
- Permisos: `0600`
- SHA-256: `a2affb46309d4e1a9fd9a978a3c2853409c9161ec5ada962f70ceac8644bf42b`
- Contenido: `roles.sql`, `schema.sql`, `data.sql`
- Cobertura observada: 17 tablas y 44 bloques `COPY`
- Restauración: requiere Supabase CLI/PostgreSQL y una base destino; no sobrescribir la base actual durante una prueba de restauración.

### Restricciones verificadas

- `pagos_online_destino_check`: exactamente uno de `reservaId` o `grupoId`.
- `pagos_online_propiedadId_fkey`: `ON DELETE RESTRICT`.
- `pagos_online_reservaId_fkey`: `ON DELETE RESTRICT`.
- `pagos_online_grupoId_fkey`: `ON DELETE RESTRICT`.
- Filas iniciales en `pagos_online`: 0; los pagos históricos requieren conciliación explícita.

### Verificación de aplicación

- Vitest: 8 archivos, 51 pruebas aprobadas.
- TypeScript: aprobado con `tsc --noEmit`.
- Build: aprobado con Next.js 16 usando Webpack.

## Puertas pendientes

- Pruebas end-to-end con Stripe Test Mode.
- Cron, alertas y runbook de incidentes.
- Piloto live y rollout gradual.

## Puerta 4 — Contexto inmutable para direct charges

- Estado: APROBADA
- Fecha: `2026-08-11`
- Commit: `065d371`
- Migración aplicada: `20260807150000_direct_charge_context`
- Base: Supabase PostgreSQL actual, tratada como producción
- Filas existentes en `pagos_online`: 0
- Modelo predeterminado histórico: `DESTINATION_LEGACY`
- `pagos_online_direct_account_check`: verificada; una fila `DIRECT` requiere `stripeConnectAccountId`.
- `pagos_online_contexto_stripe_inmutable`: verificado; modelo y cuenta originaria no pueden cambiar después de insertar el pago.
- Prueba local PostgreSQL: inserción `DIRECT` sin cuenta rechazada y cambio posterior de modelo rechazado; transacción revertida.
- Vitest: 11 archivos aprobados, 84 pruebas aprobadas y 2 E2E omitidas por defecto.
- TypeScript: aprobado con `tsc --noEmit`.

### Respaldo previo a direct charges

- Archivo: `/Users/paolabramlett/Downloads/roomly-database-backup-before-direct-charges-2026-08-11.dump`
- Formato: PostgreSQL custom archive.
- Permisos: `0600`.
- Catálogo legible: 529 entradas mediante `pg_restore --list`.
- SHA-256: `60a18f33babe512a3fdd9492e3f9c5d767c6d0709881243b30b2d9a0d6a29b0f`.

## Puerta 3 — Conciliación histórica

- Estado: APROBADA CON BLOQUEO CONSERVADOR
- Referencias históricas encontradas en Reservas: 2
- Referencias históricas encontradas en Grupos: 0
- Filas creadas en `PagoOnline`: 0
- Resultado Stripe Test: 2 `PAYMENT_INTENT_NO_ENCONTRADO`
- Resolución: conservar los identificadores como evidencia, no inferir montos y bloquear reembolsos automáticos legacy.
- Para desbloquear un caso será necesario acceder a la cuenta Stripe original y ejecutar nuevamente el conciliador contra esa cuenta.
- El conciliador opera en dry-run por defecto, rechaza llaves live sin `--allow-live` y solo aplica coincidencias exactas de estado, MXN, centavos, propiedad y cuenta Connect.
- Reporte local privado: `app/.stripe-reconciliation-report.json` (ignorado por git).

## Puerta 2 — Acceso gratuito heredado

- Estado: APROBADA
- Migración aplicada: `20260807133000_grandfathering_propiedades_existentes`
- Propiedades existentes al momento del corte: 2
- Propiedades marcadas con `accesoGratisLegacy = true`: 2
- Valor predeterminado para propiedades futuras: `false`
- Las altas nuevas continúan creando una propiedad únicamente después de completar Stripe Checkout de suscripción.
- Las propiedades legacy conservan las funciones de su `planActivo`, no generan cuota mensual y no pueden ejecutar acciones de cambio/cancelación/reactivación de suscripción.
- Vitest: 9 archivos, 55 pruebas aprobadas.
- TypeScript, ESLint y build de producción con Webpack: aprobados.
