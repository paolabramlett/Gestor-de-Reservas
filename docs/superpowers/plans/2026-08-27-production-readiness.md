# Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Llevar Roomly de sandbox a una operación real controlada, con recuperación comprobada, seguridad de datos, pagos trazables y un procedimiento reversible de despliegue.

**Architecture:** Mantener Prisma y la autorización del servidor como fuente de verdad, usando Supabase RLS como defensa adicional. Mantener cobros directos de Stripe Connect en las cuentas de los hoteles, sin introducir nuevos flujos de fondos. Operar mediante despliegues expand/contract, webhooks observables y lanzamiento gradual por hoteles.

**Tech Stack:** Next.js 16, Prisma 7, PostgreSQL/Supabase, Stripe Connect direct charges, Clerk, Vercel Cron, Vitest.

**Spec:** `CONTEXT.md`, `prisma/schema.prisma`, y los contratos de pagos/reservas implementados en `src/lib/negocio/`.

## Global Constraints

- No activar Live ni aceptar dinero real hasta cerrar las puertas P0.
- No pulsar “Resolve issue” de Supabase sin políticas y grants verificados.
- No cambiar cobros directos por destination charges ni agregar application fees.
- Toda mutación debe validar actor, `propiedadId`, monto e idempotencia en servidor.
- Toda migración de producción debe ser aditiva, reversible operacionalmente y aplicada antes del código que la consume.
- Las pruebas de aceptación deben ejecutarse contra una base aislada y nunca contra la base productiva.

### Task 1: Línea base y control de cambios

**Files:**
- Inspect: `app/package.json`, `app/prisma/schema.prisma`, `app/prisma/migrations/`, `app/vercel.json`
- Create: `docs/operations/production-readiness-checklist.md`
- Create: `docs/operations/rollback-runbook.md`

- [ ] Congelar el commit candidato y registrar versión de Node, Next, Prisma y migraciones aplicadas.
- [ ] Documentar las variables requeridas separando `DATABASE_URL` de aplicación y `DIRECT_URL` de migraciones.
- [ ] Documentar el procedimiento de rollback de Vercel y la regla de no revertir migraciones destructivas.
- [ ] Añadir criterios de salida explícitos para cada tarea de este plan.
- [ ] Revisar el documento con el propietario antes de tocar Supabase o Stripe Live.

### Task 2: Seguridad de Supabase (P0)

**Files:**
- Inspect: `app/prisma/schema.prisma`, `app/prisma/migrations/`
- Create: `app/prisma/migrations/<timestamp>_enable_rls_financial_tables/migration.sql`
- Create: `docs/operations/supabase-rls-matrix.md`
- Test: `app/scripts/verify-rls.sql`

- [ ] Inventariar grants actuales de `anon`, `authenticated`, `service_role` y del usuario usado por Prisma para `pagos_online`, `intentos_de_pago_stripe`, `pagos_externos` y `ajustes_pagos_externos`.
- [ ] Activar RLS en las cuatro tablas.
- [ ] Revocar acceso directo de roles públicos si no es necesario.
- [ ] Definir políticas mínimas: el cliente público no puede leer ni escribir; las operaciones del servidor usan una conexión privilegiada y siguen validando tenant/actor.
- [ ] Verificar que el backend sigue funcionando con Prisma después de activar RLS.
- [ ] Ejecutar el script de verificación y confirmar que Security Advisor ya no reporta exposición pública.

### Task 3: Backups y recuperación (P0)

**Files:**
- Create: `docs/operations/backup-restore-runbook.md`
- Create: `docs/operations/backup-restore-evidence.md`

- [ ] Activar backups automáticos y recuperación punto-en-tiempo en Supabase para el proyecto productivo.
- [ ] Realizar una restauración en un proyecto/base aislada; no restaurar encima de producción.
- [ ] Verificar conteos y relaciones de `propiedades`, `reservas`, `pagos_online`, `pagos_externos` y ajustes.
- [ ] Medir RPO/RTO reales y registrarlos.
- [ ] Programar una prueba de restauración mensual y conservar evidencia de cada ejecución.

### Task 4: Base de datos, pool y migraciones (P0)

**Files:**
- Inspect: `app/src/lib/prisma.ts`, `app/prisma.config.ts`, `app/vercel.json`
- Modify only if required: `app/src/lib/prisma.ts`, `app/prisma.config.ts`
- Create: `docs/operations/database-release-runbook.md`

- [ ] Confirmar en Vercel que la aplicación usa Transaction Pooler y que las migraciones usan `DIRECT_URL`/Session Pooler.
- [ ] Configurar alertas de conexiones máximas, `P1001`, `P1000` y `EMAXCONNSESSION`.
- [ ] Ejecutar `migrate status` contra la base correcta antes de cada release.
- [ ] Aplicar migraciones aditivas antes del despliegue de código y verificar una ruta crítica (`/panel`, login y consulta de reserva).
- [ ] Confirmar que el build de Vercel no depende de una base local ni de variables de sandbox.

### Task 5: Webhooks, conciliación y Stripe (P0)

**Files:**
- Inspect/modify: `app/src/app/api/webhooks/stripe/route.ts`, `app/src/lib/negocio/pagosOnline.ts`, `app/src/app/api/cron/reintentar-reembolsos/route.ts`
- Create: `docs/operations/stripe-webhook-runbook.md`
- Test: pruebas focalizadas de webhook, duplicados, reintentos, reembolsos y eventos fuera de orden

- [ ] Verificar en Stripe Workbench que existen endpoints separados y secretos correctos para plataforma y cuentas conectadas.
- [ ] Confirmar eventos necesarios: pago exitoso, pago fallido, reembolso, reembolso fallido y disputas.
- [ ] Configurar alertas para eventos fallidos y un procedimiento de replay seguro.
- [ ] Ejecutar pruebas de duplicación y reintento sin crear reservas ni pagos duplicados.
- [ ] Ejecutar una conciliación diaria entre Stripe y `pagos_online`, con reporte de discrepancias.
- [ ] Verificar que todas las cuentas nuevas conservan `fees.payer=account`, pérdidas a cargo de Stripe y cobros directos.

### Task 6: Autorización, tenant isolation y abuso (P1)

**Files:**
- Inspect/modify: `app/src/lib/auth.ts`, `app/src/lib/permisosPanel.ts`, `app/src/lib/rateLimit.ts`
- Inspect all mutating routes under: `app/src/app/(panel)/`, `app/src/app/api/`
- Create: `docs/operations/authorization-matrix.md`
- Test: matriz ADMIN/RESERVACIONES/FINANZAS/SUPER_ADMIN y dos propiedades

- [ ] Hacer que cada autorización operativa quede ligada explícitamente a `propiedadId`.
- [ ] Confirmar que FINANZAS no puede crear, editar, cancelar ni cambiar reservas.
- [ ] Sustituir el rate limit por instancia por un mecanismo distribuido antes de abrir el portal públicamente.
- [ ] Mantener respuestas genéricas en consulta de reservas y añadir límites combinados por IP, correo y código.
- [ ] Ejecutar pruebas cruzadas: usuario de hotel A intentando leer o mutar datos del hotel B.

### Task 7: Auditoría y políticas operativas (P1)

**Files:**
- Inspect/modify: modelos y acciones de reservas, grupos, lifecycle y pagos externos
- Create: migración/modelo de auditoría si no existe
- Create: `docs/operations/reservation-payment-policy.md`

- [ ] Registrar actor, fecha, propiedad, reserva, acción, importe anterior/nuevo y motivo para cancelaciones, cambios de fechas, pagos externos, ajustes y overrides de check-in.
- [ ] Definir por escrito no-show, cancelación, depósito, saldo pendiente, reembolso parcial y disputas.
- [ ] Decidir y documentar qué ocurre si se permite check-in con deuda y cómo se cobra antes/después del checkout.
- [ ] Verificar que los registros de auditoría sean append-only para usuarios operativos.

### Task 8: Privacidad, fiscalidad y soporte (P1/P2)

**Files:**
- Inspect: páginas y textos de privacidad, emails y pre-check-in
- Create: `docs/operations/data-retention-matrix.md`
- Create: `docs/operations/incident-response-runbook.md`

- [ ] Definir retención y eliminación de documentos, nacionalidad, placas, correos y teléfonos.
- [ ] Documentar exportación/corrección de datos y contacto para solicitudes de privacidad.
- [ ] Validar con asesor fiscal requisitos de facturación/CFDI, impuestos y comprobantes en México.
- [ ] Crear procedimiento para pagos disputados, cuenta Stripe restringida, correo fallido y caída de base de datos.
- [ ] Añadir monitoreo de errores con contexto no sensible y sin secretos ni datos completos de tarjeta.

### Task 9: Pruebas de aceptación y lanzamiento gradual (P0 final)

**Files:**
- Inspect: pruebas focalizadas existentes en `app/src/**`
- Create: `docs/operations/sandbox-acceptance-runbook.md`
- Create: `docs/operations/launch-gates.md`

- [ ] Ejecutar aceptación aislada: reserva individual, grupo, pago completo, pago parcial, pago externo, ajuste, reembolso, duplicado y webhook repetido.
- [ ] Ejecutar matriz de roles y aislamiento entre dos hoteles.
- [ ] Probar expiración de links, cancelación, no-show, check-in, checkout y recuperación de saldo.
- [ ] Hacer smoke test después de migración y después de deploy.
- [ ] Activar Live sólo para un hotel piloto con volumen y monto limitados.
- [ ] Revisar métricas durante 72 horas; ampliar gradualmente sólo si no hay discrepancias, errores críticos ni alertas de seguridad.

## Exit Criteria

- RLS verificado y sin tablas financieras públicamente editables.
- Restauración de backup demostrada en una base aislada.
- Pool y variables de conexión verificados en Vercel.
- Webhooks con alertas, replay y conciliación definidos.
- Matriz de roles/tenant isolation aprobada.
- Políticas de cancelación, deuda, reembolso y privacidad documentadas.
- Pruebas sandbox focalizadas verdes y smoke test post-deploy exitoso.
- Primer hotel Live operando bajo monitoreo y rollback disponible.
