# Stripe Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Llevar los flujos de Stripe Connect desde el código endurecido hasta una activación controlada con evidencia de que cobros, reservas, cancelaciones y reembolsos son consistentes.

**Architecture:** `PagoOnline` será el ledger financiero y Stripe la fuente externa de verdad para cargos y reembolsos. La salida se divide en puertas consecutivas: migración en staging, conciliación legacy, pruebas end-to-end, observabilidad y rollout gradual; cada puerta tiene criterios explícitos de aprobación y reversión.

**Tech Stack:** Next.js 16, TypeScript, Prisma 7, PostgreSQL, Stripe Connect, Vitest, Stripe CLI/webhooks, cron HTTP autenticado.

## Global Constraints

- Nunca usar llaves live durante desarrollo o pruebas automatizadas.
- Todos los montos se validan y comparan en centavos MXN.
- Un `PaymentIntent` corresponde a una sola fila de `PagoOnline`.
- No se crean saldos legacy inferidos desde `Reserva.totalMxn` o `GrupoReserva.totalPagado`.
- No activar pagos live mientras exista una discrepancia sin explicar en staging.
- Los secretos de Stripe y `CRON_SECRET` no se imprimen ni se guardan en git.

---

## File Map

- `app/prisma/migrations/20260807120000_pagos_online_ledger/migration.sql`: crea el ledger sin fabricar montos legacy.
- `app/prisma/schema.prisma`: contrato del ledger y relaciones financieras protegidas.
- `app/scripts/reconcile-stripe-ledger.ts`: nuevo comando de conciliación en modo lectura y aplicación explícita.
- `app/src/lib/negocio/reconciliacionStripe.ts`: reglas puras para clasificar coincidencias, discrepancias y registros no conciliables.
- `app/src/lib/negocio/reconciliacionStripe.test.ts`: pruebas de clasificación y centavos.
- `app/src/app/api/cron/reintentar-reembolsos/route.ts`: reintento operativo de reembolsos pendientes.
- `app/src/app/api/cron/reintentar-reembolsos/route.test.ts`: autenticación y comportamiento idempotente del cron.
- `app/src/app/api/webhooks/stripe/route.ts`: recepción idempotente de pagos.
- `app/src/app/api/webhooks/stripe/route.test.ts`: escenarios de duplicación, concurrencia, inventario y devolución.
- `docs/runbooks/stripe-incidentes.md`: diagnóstico, conciliación, replay de webhooks y rollback.
- `docs/runbooks/stripe-go-live.md`: checklist firmado de activación.

### Task 1: Aplicar y verificar la migración en staging

**Files:**
- Verify: `app/prisma/schema.prisma`
- Verify: `app/prisma/migrations/20260807120000_pagos_online_ledger/migration.sql`
- Create: `docs/runbooks/stripe-go-live.md`

**Interfaces:**
- Consumes: `DATABASE_URL` de staging y el commit `c342e06`.
- Produces: base staging con `pagos_online`, restricciones e índices verificados.

- [x] **Step 1: Crear un respaldo recuperable de la base actual**

Ejecutar con las herramientas del proveedor PostgreSQL y registrar en el checklist el identificador del snapshot, hora UTC y responsable. No continuar sin confirmar que el snapshot puede restaurarse.

- [x] **Step 2: Inspeccionar el plan de migración**

Run:

```bash
cd app
node node_modules/prisma/build/index.js migrate status
```

Expected: la migración `20260807120000_pagos_online_ledger` aparece pendiente y no hay migraciones fallidas.

- [x] **Step 3: Aplicar la migración a la base actual después del respaldo**

Run:

```bash
cd app
node node_modules/prisma/build/index.js migrate deploy
```

Expected: `All migrations have been successfully applied`.

- [x] **Step 4: Verificar restricciones financieras en PostgreSQL**

Run against staging:

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'pagos_online'::regclass
ORDER BY conname;
```

Expected: aparecen `pagos_online_destino_check` y las tres llaves foráneas con `ON DELETE RESTRICT`.

- [x] **Step 5: Ejecutar smoke test de aplicación**

Run:

```bash
cd app
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build --webpack
```

Expected: 51 o más pruebas aprobadas, TypeScript sin errores y build exitoso.

- [x] **Step 6: Registrar la puerta de migración**

En `docs/runbooks/stripe-go-live.md`, guardar commit desplegado, migración, snapshot y resultados. Commit:

```bash
git add docs/runbooks/stripe-go-live.md
git commit -m "docs: record Stripe staging migration"
```

### Task 2: Conciliar PaymentIntents legacy sin inventar montos

**Files:**
- Create: `app/src/lib/negocio/reconciliacionStripe.ts`
- Create: `app/src/lib/negocio/reconciliacionStripe.test.ts`
- Create: `app/scripts/reconcile-stripe-ledger.ts`
- Modify: `docs/runbooks/stripe-go-live.md`

**Interfaces:**
- Consumes: reservas/grupos con `stripePaymentIntentId`, Stripe API y `PagoOnline` existente.
- Produces: reporte JSON; con `--apply`, filas `PagoOnline` basadas exclusivamente en datos confirmados por Stripe.

- [x] **Step 1: Escribir pruebas fallidas de clasificación**

Cubrir exactamente: PI `succeeded` MXN con metadata coincidente; PI no exitoso; moneda distinta; propiedad/destino distinto; PI inexistente; PI ya conciliado; monto con centavos. La salida será:

```ts
type ResultadoConciliacion =
  | { estado: "CONCILIABLE"; montoCentavos: number }
  | { estado: "YA_CONCILIADO" }
  | { estado: "REVISION_MANUAL"; motivo: string };
```

- [x] **Step 2: Confirmar que las pruebas fallan**

Run:

```bash
cd app
node node_modules/vitest/vitest.mjs run src/lib/negocio/reconciliacionStripe.test.ts
```

Expected: FAIL porque el clasificador todavía no existe.

- [x] **Step 3: Implementar el clasificador puro**

Aceptar monto, moneda, estado, metadata y destino ya normalizados. Rechazar cualquier caso que no sea `succeeded`, `mxn`, entero positivo y destino Connect de la propiedad.

- [x] **Step 4: Implementar el comando dry-run/apply**

El modo predeterminado solo genera `stripe-reconciliation-report.json`. `--apply` crea una fila únicamente para resultados `CONCILIABLE`, usando `intent.amount_received / 100`, `intent.currency`, el PI real y el destino exacto Reserva o Grupo. Cada inserción usa la unicidad de `stripePaymentIntentId`; nunca actualiza montos ya conciliados.

- [x] **Step 5: Ejecutar primero en dry-run**

Run:

```bash
cd app
node --import tsx scripts/reconcile-stripe-ledger.ts
```

Expected: totales de `CONCILIABLE`, `YA_CONCILIADO` y `REVISION_MANUAL`; cero escrituras.

- [x] **Step 6: Revisar manualmente todas las discrepancias**

Comparar PI, cargo, reembolsos, metadata y cuenta destino en Stripe Dashboard. La puerta solo aprueba cuando cada discrepancia tiene resolución documentada.

- [x] **Step 7: Aplicar y repetir el dry-run**

Run:

```bash
cd app
node --import tsx scripts/reconcile-stripe-ledger.ts --apply
node --import tsx scripts/reconcile-stripe-ledger.ts
```

Expected: cero nuevos `CONCILIABLE`; únicamente `YA_CONCILIADO` o casos documentados para revisión.

- [x] **Step 8: Probar y commit**

Run:

```bash
cd app
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc --noEmit
```

Commit:

```bash
git add app/src/lib/negocio/reconciliacionStripe.ts app/src/lib/negocio/reconciliacionStripe.test.ts app/scripts/reconcile-stripe-ledger.ts docs/runbooks/stripe-go-live.md
git commit -m "feat: reconcile legacy Stripe payments"
```

### Task 3: Pruebas end-to-end de dinero e idempotencia

**Files:**
- Create: `app/src/app/api/webhooks/stripe/route.test.ts`
- Create: `app/src/app/api/cron/reintentar-reembolsos/route.test.ts`
- Modify: `docs/runbooks/stripe-go-live.md`

**Interfaces:**
- Consumes: Stripe Test Mode, webhook firmado, base staging reiniciable.
- Produces: matriz de escenarios con PI, Checkout Session, Reserva/Grupo, saldo y reembolso esperados.

- [ ] **Step 1: Añadir harness de webhook firmado**

Crear eventos Test Mode con payload fijo y firma generada mediante `stripe.webhooks.generateTestHeaderString`. Mockear solo correo; usar Stripe Test Mode para Checkout/PI y una base staging aislada para persistencia.

- [ ] **Step 2: Probar reserva individual exitosa**

Verificar: una Reserva confirmada, un `PagoOnline`, monto exacto, moneda MXN y destino Connect correcto.

- [ ] **Step 3: Repetir el mismo webhook**

Enviar el mismo evento tres veces. Verificar: una Reserva, un `PagoOnline`, cero reembolsos y respuesta idempotente.

- [ ] **Step 4: Probar dos compradores por la última habitación**

Completar dos pagos Test Mode concurrentes. Verificar: una Reserva confirmada y el otro PI completamente reembolsado; disponibilidad nunca negativa.

- [ ] **Step 5: Probar pagos concurrentes de grupo**

Enviar dos Checkout Sessions distintas contra el mismo saldo. Verificar: el total aplicado nunca supera el total del grupo y cualquier exceso queda reembolsado.

- [ ] **Step 6: Probar pago parcial y pago restante**

Verificar saldo después de cada cobro, filas separadas por PI y estado final exacto. Repetir ambos webhooks y confirmar que el saldo no cambia.

- [ ] **Step 7: Probar inconsistencia financiera**

Alterar uno por vez: monto, moneda, propiedad y cuenta destino. Verificar: no se crea Reserva/Grupo y, si el PI fue capturado, existe reembolso completo idempotente.

- [ ] **Step 8: Probar cancelación y reembolso en varios PI**

Crear dos pagos para el mismo destino, cancelar y verificar que el reembolso total no supera el neto capturado; repetir la cancelación y confirmar cero reembolso adicional.

- [ ] **Step 9: Probar fallo y reintento de reembolso**

Forzar el primer intento a fallar. Verificar `REEMBOLSO_FALLIDO`; ejecutar el cron con `CRON_SECRET`; verificar estado final y que una segunda ejecución no duplica el reembolso.

- [ ] **Step 10: Ejecutar suite y registrar evidencia**

Run:

```bash
cd app
node node_modules/vitest/vitest.mjs run
node node_modules/typescript/bin/tsc --noEmit
node node_modules/next/dist/bin/next build --webpack
```

Expected: todas las pruebas y build aprobados. Adjuntar IDs Test Mode y resultados al checklist, sin secretos ni datos personales.

- [ ] **Step 11: Commit**

```bash
git add app/src/app/api/webhooks/stripe/route.test.ts app/src/app/api/cron/reintentar-reembolsos/route.test.ts docs/runbooks/stripe-go-live.md
git commit -m "test: cover Stripe money workflows"
```

### Task 4: Observabilidad y runbook operacional

**Files:**
- Create: `docs/runbooks/stripe-incidentes.md`
- Modify: `app/src/app/api/cron/reintentar-reembolsos/route.ts`
- Modify: `docs/runbooks/stripe-go-live.md`

**Interfaces:**
- Consumes: estados `REEMBOLSO_PENDIENTE`/`REEMBOLSO_FALLIDO`, logs del hosting y alertas Stripe.
- Produces: alertas accionables y pasos reproducibles de recuperación.

- [ ] **Step 1: Definir señales obligatorias**

Registrar métricas o logs estructurados para: webhook fallido, firma inválida, pago reembolsado por inconsistencia, reembolso pendiente/fallido, PI duplicado y conciliación imposible. Cada evento incluye `paymentIntentId`, `checkoutSessionId`, `propiedadId` y código de error; nunca incluye email, teléfono ni secretos.

- [ ] **Step 2: Configurar el cron autenticado**

Definir `CRON_SECRET` en staging y producción. Programar `/api/cron/reintentar-reembolsos` cada cinco minutos con `Authorization: Bearer <CRON_SECRET>`.

- [ ] **Step 3: Configurar alertas**

Alertar inmediatamente por cualquier `REEMBOLSO_FALLIDO`, cinco fallos de webhook en cinco minutos o discrepancia de conciliación. Alertar en 15 minutos si un reembolso sigue pendiente.

- [ ] **Step 4: Escribir el runbook**

Documentar: verificar evento en Stripe, consultar ledger por PI, reintentar webhook, ejecutar cron, realizar reembolso manual, reconciliar DB y escalar. Incluir explícitamente que nunca se edita `montoMxn` para “hacer cuadrar” un pago.

- [ ] **Step 5: Simular incidente**

En staging, provocar un fallo de reembolso, seguir el runbook y medir tiempo de recuperación. Puerta aprobada si otra persona puede resolverlo sin ayuda del autor.

- [ ] **Step 6: Commit**

```bash
git add app/src/app/api/cron/reintentar-reembolsos/route.ts docs/runbooks/stripe-incidentes.md docs/runbooks/stripe-go-live.md
git commit -m "docs: add Stripe incident operations"
```

### Task 5: Activación gradual y criterio go/no-go

**Files:**
- Modify: `docs/runbooks/stripe-go-live.md`

**Interfaces:**
- Consumes: cuatro puertas anteriores aprobadas.
- Produces: Stripe live habilitado gradualmente o rollback documentado.

- [ ] **Step 1: Confirmar precondiciones live**

Debe existir evidencia de: respaldo, migración, cero discrepancias no explicadas, suite completa, build, cron, alertas, webhook live firmado, cuenta Connect habilitada y política de reembolso validada.

- [ ] **Step 2: Hacer transacción live controlada**

Usar un monto mínimo permitido y una propiedad interna. Verificar Checkout, PI, destination charge, application fee, ledger, Reserva y correo. Cancelar y verificar el reembolso en Stripe y DB.

- [ ] **Step 3: Activar una sola propiedad piloto**

Mantener el resto sin pagos live. Observar durante 24 horas o al menos 20 transacciones reales, lo que ocurra después.

- [ ] **Step 4: Evaluar go/no-go**

GO requiere: cero cobros sin Reserva, cero Reservas sin pago aplicable, cero duplicados, cero saldo negativo, cero reembolsos pendientes por más de 15 minutos y conciliación Stripe/ledger exacta. Cualquier incumplimiento es NO-GO y desactiva nuevos checkouts mientras se preservan webhooks y reembolsos.

- [ ] **Step 5: Expandir por lotes**

Activar propiedades en lotes pequeños, revisar las mismas métricas después de cada lote y detener el rollout ante la primera discrepancia.

- [ ] **Step 6: Cerrar checklist**

Registrar fecha, commit, responsables, propiedades activadas y evidencia de conciliación. Commit:

```bash
git add docs/runbooks/stripe-go-live.md
git commit -m "docs: complete Stripe production rollout"
```

## Final Verification Gate

- [ ] La migración existe y fue aplicada después de un snapshot recuperable.
- [ ] Todos los pagos legacy están conciliados o explícitamente bloqueados.
- [ ] La suite cubre duplicados, concurrencia, exceso, cancelación y reintentos.
- [ ] Stripe Dashboard y `PagoOnline` coinciden por PI y centavos.
- [ ] El cron y las alertas fueron probados, no solo configurados.
- [ ] El piloto live cumple todos los criterios GO antes de ampliar el rollout.
