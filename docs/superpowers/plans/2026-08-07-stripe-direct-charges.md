# Stripe Connect Direct Charges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar los cobros a huéspedes desde destination charges de la plataforma hacia direct charges creados en la cuenta Stripe de cada hotel, sin perder la capacidad de conciliar o reembolsar pagos históricos.

**Architecture:** Cada operación nueva se crea y consulta con `Stripe-Account` igual a la cuenta Connect inmutable del hotel. `PagoOnline` registra tanto la cuenta propietaria del objeto Stripe como el modelo de cobro; los webhooks Connected accounts validan `event.account` antes de entregar inventario. Los pagos legacy continúan reembolsándose en el contexto de plataforma.

**Tech Stack:** Next.js 16, TypeScript, Prisma 7, PostgreSQL, Stripe Connect, Stripe.js, Vitest, Stripe Test sandbox.

## Global Constraints

- Nunca usar llaves live durante desarrollo o pruebas automatizadas.
- Todos los montos se validan y comparan en centavos MXN.
- Un `PaymentIntent` corresponde a una sola fila de `PagoOnline`.
- Todo direct charge se crea, recupera, lista y reembolsa con la misma cuenta `Stripe-Account`.
- Ningún fulfillment ocurre antes de verificar `event.account` contra la propiedad y la metadata.
- Los cargos destination históricos conservan su ruta de reembolso con `reverse_transfer`; los direct charges nunca usan `reverse_transfer`.
- Los reembolsos de direct charges incluyen `refund_application_fee: true` para devolver proporcionalmente la comisión de Roomly.
- Los secretos de Stripe nunca se imprimen ni se guardan en git.
- No activar pagos live hasta que la suite E2E, el webhook Connect y el runbook estén aprobados.

---

### Task 1: Contrato de direct charge y propiedad inmutable del pago

**Files:**
- Modify: `app/prisma/schema.prisma`
- Create: `app/prisma/migrations/20260807150000_direct_charge_context/migration.sql`
- Modify: `app/src/lib/stripeConnect.ts`
- Modify: `app/src/lib/stripeConnect.test.ts`
- Modify: `app/src/lib/negocio/pagosOnline.ts`
- Modify: `app/src/lib/negocio/pagosOnline.test.ts`

**Interfaces:**
- Produces: `ModeloCobroStripe = DESTINATION_LEGACY | DIRECT`.
- Produces: `PagoOnline.stripeConnectAccountId: String?` y `PagoOnline.modeloCobro`.
- Produces: `crearDirectCharge(propiedad, montoMxn)` con `{ paymentIntentData, requestOptions, stripeAccountId }`.
- Produces: `validarCuentaEvento(cuentaRecibida, cuentaEsperada)`.

- [ ] **Step 1: Escribir pruebas fallidas del contrato**

Probar que un cobro nuevo contiene `application_fee_amount`, omite `transfer_data` y devuelve `{ stripeAccount }`; que una cuenta ausente falla; y que `validarCuentaEvento` rechaza `null` o una cuenta distinta.

- [ ] **Step 2: Ejecutar las pruebas y confirmar RED**

Run: `node node_modules/vitest/vitest.mjs run src/lib/stripeConnect.test.ts src/lib/negocio/pagosOnline.test.ts`

- [ ] **Step 3: Implementar el contrato mínimo y el esquema**

La migración agrega columnas nullable/backward-compatible. Los registros existentes quedan `DESTINATION_LEGACY`; los nuevos se escriben explícitamente como `DIRECT` con su account ID.

- [ ] **Step 4: Ejecutar migración y pruebas en PostgreSQL aislado**

Run: `DATABASE_URL=<local-e2e> DIRECT_URL=<local-e2e> node node_modules/prisma/build/index.js migrate deploy`

- [ ] **Step 5: Ejecutar pruebas y TypeScript**

Run: `node node_modules/vitest/vitest.mjs run src/lib/stripeConnect.test.ts src/lib/negocio/pagosOnline.test.ts && node node_modules/typescript/bin/tsc --noEmit`

- [ ] **Step 6: Commit**

Commit: `feat: add direct charge payment context`

### Task 2: Crear pagos nuevos dentro de la cuenta del hotel

**Files:**
- Modify: `app/src/app/api/reservas/checkout/route.ts`
- Modify: `app/src/app/api/reservas/checkout-grupo/route.ts`
- Modify: `app/src/lib/negocio/reservas.ts`
- Modify: `app/src/app/(panel)/panel/reservas/actions.ts`
- Modify: `app/src/app/(panel)/panel/grupos/actions.ts`
- Modify: `app/src/app/(portal)/p/[slug]/reservar/FormularioReserva.tsx`
- Test: route/action tests colocados junto a cada interfaz pública.

**Interfaces:**
- Consumes: Task 1 `crearDirectCharge`.
- Produces: PaymentIntents y Checkout Sessions creados con `{ stripeAccount: accountId }`.
- Produces: checkout individual `{ clientSecret, stripeAccountId }` para que Stripe.js use `loadStripe(pk, { stripeAccount })`.

- [ ] **Step 1: Escribir una prueba fallida para PaymentIntent individual**

Verificar que el request Stripe contiene fee pero no destination y que las opciones llevan la cuenta Connect.

- [ ] **Step 2: Implementar PaymentIntent y PaymentElement directos**

La respuesta incluye la cuenta validada. El cliente crea la instancia Stripe por cuenta; nunca confirma un client secret directo con el contexto de plataforma.

- [ ] **Step 3: Escribir pruebas fallidas para los cuatro flujos Checkout**

Cubrir reserva pública múltiple, link manual individual, solicitud desde panel y pago de grupo. Verificar también que `expire` usa el mismo account ID.

- [ ] **Step 4: Implementar Checkout directo e idempotency keys**

Usar `payment_intent_data.application_fee_amount`, omitir `transfer_data`, y pasar `{ stripeAccount, idempotencyKey }` como opciones de request.

- [ ] **Step 5: Ejecutar pruebas focalizadas y TypeScript**

- [ ] **Step 6: Commit**

Commit: `feat: create guest payments on hotel accounts`

### Task 3: Validar y procesar webhooks de cuentas conectadas

**Files:**
- Modify: `app/src/app/api/webhooks/stripe/route.ts`
- Modify: `app/src/app/api/webhooks/stripe/route.test.ts`
- Modify: `app/src/lib/negocio/reservas.ts`
- Modify: all `PagoOnline.create` sites in the webhook.

**Interfaces:**
- Consumes: Stripe Connected account event `event.account`.
- Produces: cada fila nueva `PagoOnline` con `modeloCobro: DIRECT` y `stripeConnectAccountId: event.account`.

- [ ] **Step 1: Convertir el E2E a direct charges y confirmar RED**

Crear PaymentIntents con `{ stripeAccount }`, construir eventos con `account`, y firmarlos con el secreto Connect.

- [ ] **Step 2: Rechazar eventos sin cuenta o de otro hotel**

Antes de reservar, aplicar pagos o reembolsar, comparar `event.account`, metadata y `Propiedad.stripeConnectAccountId`.

- [ ] **Step 3: Consultar objetos Stripe en contexto conectado**

`paymentIntents.retrieve` y `checkout.sessions.listLineItems` reciben `{ stripeAccount: event.account }`.

- [ ] **Step 4: Reclamar `StripeEventoProcesado` atómicamente**

El mismo `event.id` responde exitosamente sin repetir fulfillment, correos ni reembolsos. Los constraints de PI/Session permanecen como segunda defensa.

- [ ] **Step 5: Ejecutar E2E de duplicado y última habitación**

Expected: una Reserva/PagoOnline por PI; ante competencia, una reserva y un reembolso directo total.

- [ ] **Step 6: Commit**

Commit: `feat: process connected account payment events`

### Task 4: Reembolsos directos y compatibilidad legacy

**Files:**
- Modify: `app/src/lib/stripeConnect.ts`
- Modify: `app/src/lib/negocio/pagosOnline.ts`
- Modify: `app/src/app/api/cron/reintentar-reembolsos/route.ts`
- Modify: `app/src/lib/negocio/cicloDeVida.ts`
- Modify: `app/src/app/api/reservas/cancelar/route.ts`
- Modify: `app/src/app/api/cambios/[token]/aceptar/route.ts`
- Modify: webhook refund call sites.
- Test: refund and cron tests.

**Interfaces:**
- Consumes: `{ paymentIntentId, modeloCobro, stripeConnectAccountId, amount, idempotencyKey }`.
- Produces: refund direct con `{ stripeAccount }` y `refund_application_fee`; refund legacy en plataforma con `reverse_transfer`.

- [ ] **Step 1: Escribir pruebas fallidas de las dos rutas de reembolso**

Direct requiere account ID y nunca envía `reverse_transfer`; legacy usa plataforma y `reverse_transfer: true`.

- [ ] **Step 2: Resolver toda cancelación mediante `PagoOnline`**

No recuperar ni listar un PaymentIntent directo desde plataforma. El ledger determina cuenta, modelo y saldo reembolsable.

- [ ] **Step 3: Adaptar cron e idempotency keys**

Cada reintento usa el contexto inmutable guardado y no duplica un reembolso exitoso.

- [ ] **Step 4: Ejecutar pruebas de parcial, completo, repetido y fallo/reintento**

- [ ] **Step 5: Commit**

Commit: `fix: scope refunds to originating Stripe account`

### Task 5: Evidencia E2E, configuración y operación

**Files:**
- Modify: `app/src/app/api/webhooks/stripe/route.test.ts`
- Modify: `docs/runbooks/stripe-go-live.md`
- Create/Modify: `docs/runbooks/stripe-incidentes.md`

**Interfaces:**
- Consumes: endpoint Stripe de alcance Connected accounts y `STRIPE_WEBHOOK_SECRET_CONNECT`.
- Produces: evidencia reproducible de cobro, ledger, competencia, cancelación y reembolso en sandbox.

- [ ] **Step 1: Configurar eventos del endpoint Connect en sandbox**

Suscribir `payment_intent.succeeded`, `checkout.session.completed`, `checkout.session.expired` y `account.updated`; nunca copiar secretos al repositorio.

- [ ] **Step 2: Ejecutar matriz E2E completa**

Incluir individual, grupo, link manual, webhook repetido, última habitación, monto/moneda/cuenta incorrectos, reembolso parcial/completo y cron.

- [ ] **Step 3: Verificar balances Test**

El cargo aparece en el hotel conectado; la comisión aparece en Roomly; el reembolso revierte cargo y comisión según política.

- [ ] **Step 4: Ejecutar suite, TypeScript, lint y build**

Run: `node node_modules/vitest/vitest.mjs run && node node_modules/typescript/bin/tsc --noEmit && node node_modules/next/dist/bin/next build --webpack`

- [ ] **Step 5: Actualizar runbooks y criterio go/no-go**

Eliminar referencias a destination charges como modelo futuro; conservarlas solo como compatibilidad legacy.

- [ ] **Step 6: Commit**

Commit: `test: verify direct charge money workflows`

