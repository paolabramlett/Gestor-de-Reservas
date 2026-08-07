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

- Grandfathering de propiedades existentes y onboarding oficial para propiedades nuevas.
- Conciliación de PaymentIntents históricos.
- Pruebas end-to-end con Stripe Test Mode.
- Cron, alertas y runbook de incidentes.
- Piloto live y rollout gradual.
