# External Payment Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the editable manual payment status with an auditable external-payment ledger, derive every financial status from Stripe and external movements, and send accurate partial/full payment receipts.

**Architecture:** Keep `PagoOnline` as the immutable Stripe-owned ledger and add append-only `PagoExterno` charges plus linked `AjustePagoExterno` reversals/refunds. A single financial-summary module becomes the source of truth for UI, payment links, lifecycle checks, reports, and emails; all external-payment mutations run under a reservation advisory lock with server-side role, balance, and idempotency checks.

**Tech Stack:** Next.js 16 App Router and Server Actions, React 19, TypeScript, Prisma 7/PostgreSQL, Vitest, React Email/Resend, Stripe Connect direct charges.

**Spec:** `docs/superpowers/specs/2026-08-14-ledger-pagos-externos-design.md`

## Global Constraints

- `PagoOnline` remains webhook-owned and must never be editable from the panel.
- Roomly records external payments and refunds but never moves external money.
- Financial status is always derived; no editable `PENDIENTE`/`ANTICIPO_PAGADO`/`PAGADO_COMPLETO` selector remains.
- `ADMIN`, `SUPER_ADMIN`, and `RESERVACIONES` may mutate external payments; `FINANZAS` is read-only.
- Every mutation rechecks authentication, property ownership, role, balance, and reservation state on the server.
- Every external financial mutation is transactional, idempotent, and guarded by `pg_advisory_xact_lock` on `reservaId`.
- Financial rows are never hard-deleted. Corrections annul the original and create a replacement atomically.
- The external-payment receipt checkbox defaults to enabled; email failure never rolls back a payment.
- All monetary calculations use integer centavos internally and MXN decimal columns at persistence boundaries.
- External writes remain behind `PAGOS_EXTERNOS_LEDGER_ENABLED=false` until migration reconciliation passes.
- Stripe Live is not enabled by this plan.

---

### Task 1: Central financial summary and permissions

**Files:**
- Create: `app/src/lib/negocio/resumenFinanciero.ts`
- Create: `app/src/lib/negocio/resumenFinanciero.test.ts`
- Create: `app/src/lib/negocio/permisosPagosExternos.ts`
- Create: `app/src/lib/negocio/permisosPagosExternos.test.ts`
- Modify: `app/src/lib/negocio/pagosOnline.ts`
- Modify: `app/src/lib/negocio/pagosOnline.test.ts`

**Interfaces:**
- Produces: `calcularResumenFinanciero(input: ResumenFinancieroInput): ResumenFinanciero`.
- Produces: `puedeMutarPagosExternos(rol: RolUsuario): boolean`.
- Produces: centavo helpers `aCentavos`, `aMxn`, and `netoPagoStripeCentavos` used by later services.
- Replaces: reservation-balance logic currently embedded in `pagosOnline.ts`; keep a temporary compatibility wrapper so existing callers compile during the migration.

- [ ] **Step 1: Write the failing summary tests**

```ts
import { describe, expect, it } from "vitest";
import { calcularResumenFinanciero } from "./resumenFinanciero";

describe("calcularResumenFinanciero", () => {
  it("separa un anticipo Stripe del saldo pendiente", () => {
    expect(calcularResumenFinanciero({
      totalReservaCentavos: 600_000,
      pagosStripe: [{ cobradoCentavos: 300_000, reembolsadoCentavos: 0, reembolsoPendienteCentavos: 0 }],
      pagosExternos: [],
    })).toMatchObject({
      stripeNetoCentavos: 300_000,
      externoNetoCentavos: 0,
      pagadoNetoCentavos: 300_000,
      saldoPendienteCentavos: 300_000,
      estado: "PAGO_PARCIAL",
    });
  });

  it("reabre únicamente el saldo reembolsado", () => {
    expect(calcularResumenFinanciero({
      totalReservaCentavos: 600_000,
      pagosStripe: [{ cobradoCentavos: 300_000, reembolsadoCentavos: 100_000, reembolsoPendienteCentavos: 0 }],
      pagosExternos: [{ cobradoCentavos: 300_000, ajustesCentavos: 0 }],
    }).saldoPendienteCentavos).toBe(100_000);
  });
});
```

- [ ] **Step 2: Run the summary tests and verify RED**

Run: `cd app && npm test -- src/lib/negocio/resumenFinanciero.test.ts`  
Expected: FAIL because `resumenFinanciero.ts` does not exist.

- [ ] **Step 3: Implement the pure summary module**

```ts
export type EstadoFinanciero = "SIN_PAGOS" | "PAGO_PARCIAL" | "PAGO_COMPLETO";

export type ResumenFinancieroInput = {
  totalReservaCentavos: number;
  pagosStripe: Array<{
    cobradoCentavos: number;
    reembolsadoCentavos: number;
    reembolsoPendienteCentavos: number;
  }>;
  pagosExternos: Array<{ cobradoCentavos: number; ajustesCentavos: number }>;
};

export type ResumenFinanciero = {
  totalReservaCentavos: number;
  stripeNetoCentavos: number;
  externoNetoCentavos: number;
  pagadoNetoCentavos: number;
  saldoPendienteCentavos: number;
  estado: EstadoFinanciero;
};

export function calcularResumenFinanciero(input: ResumenFinancieroInput): ResumenFinanciero {
  const stripeNetoCentavos = input.pagosStripe.reduce(
    (s, p) => s + Math.max(0, p.cobradoCentavos - p.reembolsadoCentavos - p.reembolsoPendienteCentavos),
    0
  );
  const externoNetoCentavos = input.pagosExternos.reduce(
    (s, p) => s + Math.max(0, p.cobradoCentavos - p.ajustesCentavos),
    0
  );
  const pagadoNetoCentavos = Math.min(input.totalReservaCentavos, Math.max(0, stripeNetoCentavos + externoNetoCentavos));
  const saldoPendienteCentavos = Math.max(0, input.totalReservaCentavos - pagadoNetoCentavos);
  const estado = pagadoNetoCentavos === 0 ? "SIN_PAGOS" : saldoPendienteCentavos === 0 ? "PAGO_COMPLETO" : "PAGO_PARCIAL";
  return { ...input, stripeNetoCentavos, externoNetoCentavos, pagadoNetoCentavos, saldoPendienteCentavos, estado };
}
```

Implement centavo conversion with `Number.isSafeInteger` validation; reject negative reservation totals and non-integer centavos.

- [ ] **Step 4: Write and run the failing permission tests**

```ts
it.each(["ADMIN", "SUPER_ADMIN", "RESERVACIONES"])("permite mutar a %s", (rol) => {
  expect(puedeMutarPagosExternos(rol as RolUsuario)).toBe(true);
});
it("Finanzas es solo lectura", () => {
  expect(puedeMutarPagosExternos("FINANZAS")).toBe(false);
});
```

Run: `cd app && npm test -- src/lib/negocio/permisosPagosExternos.test.ts`  
Expected: FAIL because the permission function does not exist.

- [ ] **Step 5: Implement permissions and compatibility wrapper**

```ts
const ROLES_ESCRITURA = new Set<RolUsuario>([
  RolUsuario.ADMIN,
  RolUsuario.SUPER_ADMIN,
  RolUsuario.RESERVACIONES,
]);
export const puedeMutarPagosExternos = (rol: RolUsuario) => ROLES_ESCRITURA.has(rol);
```

Adapt `calcularResumenPagoReserva` to call the new engine while legacy `PagoManual` is still present. Do not add new business logic to the wrapper.

- [ ] **Step 6: Verify and commit**

Run: `cd app && npm test -- src/lib/negocio/resumenFinanciero.test.ts src/lib/negocio/permisosPagosExternos.test.ts src/lib/negocio/pagosOnline.test.ts`  
Expected: PASS.

```bash
git add app/src/lib/negocio/resumenFinanciero.ts app/src/lib/negocio/resumenFinanciero.test.ts app/src/lib/negocio/permisosPagosExternos.ts app/src/lib/negocio/permisosPagosExternos.test.ts app/src/lib/negocio/pagosOnline.ts app/src/lib/negocio/pagosOnline.test.ts
git commit -m "feat: centralize reservation financial summary"
```

---

### Task 2: Additive Prisma ledger schema and legacy classifier

**Files:**
- Modify: `app/prisma/schema.prisma`
- Create: `app/prisma/migrations/20260814190000_pagos_externos_ledger/migration.sql`
- Create: `app/src/lib/negocio/migracionPagosExternos.ts`
- Create: `app/src/lib/negocio/migracionPagosExternos.test.ts`

**Interfaces:**
- Consumes: centavo helpers from Task 1.
- Produces: Prisma models `PagoExterno` and `AjustePagoExterno` with enums `MetodoPagoExterno`, `TipoAjustePagoExterno`, and `EstadoComprobantePago`.
- Produces: `clasificarPagoManualLegacy(input): CandidatoPagoExternoLegacy | null` for the backfill script.

- [ ] **Step 1: Write failing legacy-classification tests**

```ts
it("no migra un pendiente sin importe", () => {
  expect(clasificarPagoManualLegacy({ estado: "PENDIENTE", montoAnticipoCentavos: null, totalCentavos: 600_000, stripeNetoCentavos: 0 })).toBeNull();
});

it("migra un completo legacy solo por el saldo no cubierto por Stripe", () => {
  expect(clasificarPagoManualLegacy({ estado: "PAGADO_COMPLETO", montoAnticipoCentavos: null, totalCentavos: 600_000, stripeNetoCentavos: 300_000 }))
    .toMatchObject({ montoCentavos: 300_000, requiereRevision: false });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `cd app && npm test -- src/lib/negocio/migracionPagosExternos.test.ts`  
Expected: FAIL because the classifier does not exist.

- [ ] **Step 3: Implement the classifier**

Return `null` for no-money rows. Return `{ montoCentavos, nota, requiereRevision, motivoRevision }` for convertible rows. Mark negative, zero, over-total, or ambiguous rows for review instead of silently fixing them.

- [ ] **Step 4: Add schema relations and enums**

Add these relations to `Propiedad`, `Reserva`, and `UsuarioPropiedad`, then generate the migration:

```prisma
enum MetodoPagoExterno { EFECTIVO TRANSFERENCIA TERMINAL_EXTERNA OTRO }
enum TipoAjustePagoExterno { ANULACION REEMBOLSO }
enum EstadoComprobantePago { NO_SOLICITADO PENDIENTE ENVIADO FALLIDO }

model PagoExterno {
  id                       String @id @default(cuid())
  propiedadId              String
  reservaId                String
  montoMxn                 Decimal @db.Decimal(10, 2)
  metodo                    MetodoPagoExterno
  fechaPago                DateTime
  nota                      String?
  creadoPorUsuarioId       String?
  idempotencyKey           String @unique
  reemplazaPagoExternoId   String?
  estadoComprobante        EstadoComprobantePago @default(NO_SOLICITADO)
  comprobanteEnviadoEn     DateTime?
  comprobanteError         String?
  creadoEn                 DateTime @default(now())
  propiedad                Propiedad @relation(fields: [propiedadId], references: [id], onDelete: Restrict)
  reserva                  Reserva @relation(fields: [reservaId], references: [id], onDelete: Restrict)
  creadoPor                UsuarioPropiedad? @relation(fields: [creadoPorUsuarioId], references: [id], onDelete: SetNull)
  reemplaza                PagoExterno? @relation("CorreccionPagoExterno", fields: [reemplazaPagoExternoId], references: [id], onDelete: Restrict)
  reemplazos               PagoExterno[] @relation("CorreccionPagoExterno")
  ajustes                  AjustePagoExterno[]
  @@index([reservaId, creadoEn])
  @@index([propiedadId, fechaPago])
  @@map("pagos_externos")
}

model AjustePagoExterno {
  id                 String @id @default(cuid())
  pagoExternoId      String
  tipo               TipoAjustePagoExterno
  montoMxn           Decimal @db.Decimal(10, 2)
  motivo             String
  creadoPorUsuarioId String?
  idempotencyKey     String @unique
  creadoEn           DateTime @default(now())
  pagoExterno        PagoExterno @relation(fields: [pagoExternoId], references: [id], onDelete: Restrict)
  creadoPor          UsuarioPropiedad? @relation(fields: [creadoPorUsuarioId], references: [id], onDelete: SetNull)
  @@index([pagoExternoId, creadoEn])
  @@map("ajustes_pagos_externos")
}
```

The SQL migration must add `CHECK (monto_mxn > 0)` constraints to both money columns and must not drop or mutate `pagos_manuales`.

- [ ] **Step 5: Validate generated client and migration**

Run: `cd app && npx prisma format && npx prisma validate && npx prisma generate`  
Expected: all commands exit 0.

- [ ] **Step 6: Verify and commit**

Run: `cd app && npm test -- src/lib/negocio/migracionPagosExternos.test.ts`  
Expected: PASS.

```bash
git add app/prisma/schema.prisma app/prisma/migrations/20260814190000_pagos_externos_ledger/migration.sql app/src/lib/negocio/migracionPagosExternos.ts app/src/lib/negocio/migracionPagosExternos.test.ts
git commit -m "feat: add external payment ledger schema"
```

---

### Task 3: Transactional external-payment service

**Files:**
- Create: `app/src/lib/negocio/pagosExternos.server.ts`
- Create: `app/src/lib/negocio/pagosExternos.test.ts`
- Create: `app/src/lib/negocio/pagosExternos.e2e.test.ts`
- Modify: `app/src/lib/auth.ts`

**Interfaces:**
- Consumes: `calcularResumenFinanciero` and `puedeMutarPagosExternos`.
- Produces: `registrarPagoExterno`, `corregirPagoExterno`, `ajustarPagoExterno`, `obtenerLedgerReserva`.
- Produces: domain errors `PAGOS_EXTERNOS_DESHABILITADOS`, `ROL_PAGO_EXTERNO_DENEGADO`, `SALDO_INSUFICIENTE`, `AJUSTE_SUPERA_DISPONIBLE`, and `ESTADO_RESERVA_NO_ADMITE_COBRO`.

- [ ] **Step 1: Write failing service tests for validation and idempotency**

Use dependency injection for a transaction-shaped repository; do not mock internal helpers. Cover:

```ts
const actorFinanzas = { usuarioPropiedadId: "usr_fin", propiedadId: "prop_1", rol: "FINANZAS" as const };
const actorAdmin = { usuarioPropiedadId: "usr_admin", propiedadId: "prop_1", rol: "ADMIN" as const };
const input = { reservaId: "res_1", montoCentavos: 300_000, metodo: "TRANSFERENCIA" as const, fechaPago: new Date("2026-08-14T16:00:00Z"), enviarComprobante: true, idempotencyKey: "idem_1" };

it("rechaza Finanzas antes de escribir", async () => {
  const { service, repo } = escenarioServicio({ saldoCentavos: 300_000 });
  await expect(service.registrarPagoExterno(actorFinanzas, input)).rejects.toThrow("ROL_PAGO_EXTERNO_DENEGADO");
  expect(repo.creados).toHaveLength(0);
});

it("rechaza un importe superior al saldo recalculado", async () => {
  const { service } = escenarioServicio({ saldoCentavos: 299_999 });
  await expect(service.registrarPagoExterno(actorAdmin, input)).rejects.toThrow("SALDO_INSUFICIENTE");
});

it("devuelve el mismo movimiento al repetir idempotencyKey", async () => {
  const { service, repo } = escenarioServicio({ saldoCentavos: 300_000 });
  const primero = await service.registrarPagoExterno(actorAdmin, input);
  const segundo = await service.registrarPagoExterno(actorAdmin, input);
  expect(segundo.id).toBe(primero.id);
  expect(repo.creados).toHaveLength(1);
});

it("una corrección anula lo disponible y crea el reemplazo", async () => {
  const { service, repo } = escenarioServicio({ pagoExternoCentavos: 300_000, saldoCentavos: 300_000 });
  await service.corregirPagoExterno(actorAdmin, { pagoExternoId: "ext_1", nuevoMontoCentavos: 250_000, metodo: "EFECTIVO", fechaPago: new Date("2026-08-14T17:00:00Z"), motivo: "Importe capturado incorrectamente", nota: "Corrección", idempotencyKey: "corr_1" });
  expect(repo.ajustes).toContainEqual(expect.objectContaining({ tipo: "ANULACION", montoCentavos: 300_000 }));
  expect(repo.creados).toContainEqual(expect.objectContaining({ montoCentavos: 250_000, reemplazaPagoExternoId: "ext_1" }));
});

it("un reembolso parcial no puede superar el disponible externo", async () => {
  const { service } = escenarioServicio({ pagoExternoCentavos: 100_000, ajustesCentavos: 20_000 });
  await expect(service.ajustarPagoExterno(actorAdmin, { pagoExternoId: "ext_1", tipo: "REEMBOLSO", montoCentavos: 80_001, motivo: "Devolución", idempotencyKey: "refund_1" })).rejects.toThrow("AJUSTE_SUPERA_DISPONIBLE");
});
```

Implement `escenarioServicio` in the test as an in-memory repository that records writes and exposes only the public service methods.

- [ ] **Step 2: Run and verify RED**

Run: `cd app && npm test -- src/lib/negocio/pagosExternos.test.ts`  
Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement service input types and feature flag**

```ts
type ActorPagoExterno = { usuarioPropiedadId: string; propiedadId: string; rol: RolUsuario };
type RegistrarPagoExternoInput = {
  reservaId: string;
  montoCentavos: number;
  metodo: MetodoPagoExterno;
  fechaPago: Date;
  nota?: string;
  enviarComprobante: boolean;
  idempotencyKey: string;
};
```

`PAGOS_EXTERNOS_LEDGER_ENABLED` must equal `"true"`; any other value disables writes.

- [ ] **Step 4: Implement transaction and lock order**

Within `prisma.$transaction`:

```ts
await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.reservaId}, 19))`;
```

Then check idempotency, load reservation scoped to `actor.propiedadId`, load Stripe/external movements, calculate summary, validate state/amount, and insert. Never trust a client-provided balance or role.

- [ ] **Step 5: Implement append-only correction and adjustments**

- Correction transaction: lock; verify original and available amount; insert full `ANULACION`; insert replacement with `reemplazaPagoExternoId`; return both.
- Anulment: require non-blank reason; insert full available amount with type `ANULACION`.
- Refund: require non-blank reason and a positive amount not exceeding available; insert `REEMBOLSO`.
- Reject ordinary charges for `CANCELADA`, `NO_SHOW`, or `COMPLETADA`; allow adjustments on existing movements.

- [ ] **Step 6: Add PostgreSQL E2E concurrency tests**

Use the existing E2E environment guard so the file skips without `DATABASE_URL_E2E`. Launch two promises with different idempotency keys whose combined amount exceeds the balance; assert one succeeds, one returns `SALDO_INSUFICIENTE`, and the net persisted amount never exceeds the reservation total.

- [ ] **Step 7: Verify and commit**

Run: `cd app && npm test -- src/lib/negocio/pagosExternos.test.ts src/lib/negocio/pagosExternos.e2e.test.ts`  
Expected: unit tests pass; E2E passes when configured or reports skipped otherwise.

```bash
git add app/src/lib/negocio/pagosExternos.server.ts app/src/lib/negocio/pagosExternos.test.ts app/src/lib/negocio/pagosExternos.e2e.test.ts app/src/lib/auth.ts
git commit -m "feat: add transactional external payment service"
```

---

### Task 4: Accurate payment receipts and retry state

**Files:**
- Modify: `app/src/emails/ConfirmacionReserva.tsx`
- Modify: `app/src/lib/emails.ts`
- Create: `app/src/lib/emailsPago.test.ts`
- Modify: `app/src/app/api/webhooks/stripe/route.ts`
- Modify: `app/src/app/api/webhooks/stripe/route.test.ts`
- Modify: `app/src/app/api/webhooks/stripe/route.direct.test.ts`
- Modify: `app/src/lib/negocio/pagosExternos.server.ts`

**Interfaces:**
- Produces: `ResumenCorreoPago` and `enviarComprobantePago(params)`.
- Consumes: financial summary from Task 1 after each persisted movement.
- Updates: `PagoExterno.estadoComprobante`, `comprobanteEnviadoEn`, and sanitized `comprobanteError` without changing payment persistence.

- [ ] **Step 1: Write the failing email-semantic tests**

```ts
it("un anticipo no afirma que el total de la reserva fue pagado", async () => {
  const html = await renderizarComprobantePago({
    montoRecibidoCentavos: 300_000,
    totalPagadoCentavos: 300_000,
    totalReservaCentavos: 600_000,
    saldoPendienteCentavos: 300_000,
    codigoReserva: "RES-EJ7B-DNAS",
    nombreHuesped: "José Ramiro López",
    nombreHotel: "Hotel Casa Canteras",
    tipoHabitacion: "Suite Deluxe",
    fechaIngreso: "16 de agosto de 2026",
    fechaSalida: "19 de agosto de 2026",
    numPersonas: 2,
    colorPrimario: "#1d4ed8",
    linkPreCheckin: "https://example.test/precheckin",
  });
  expect(html).toContain("Anticipo recibido");
  expect(html).toContain("Pago recibido ahora");
  expect(html).toContain("$3,000 MXN");
  expect(html).not.toContain("Total pagado</");
});
```

Also test a complete payment uses `Pago completado` and `$0 MXN` pending.

- [ ] **Step 2: Run and verify RED**

Run: `cd app && npm test -- src/lib/emailsPago.test.ts`  
Expected: FAIL because the receipt renderer does not exist and the current template says `Total pagado`.

- [ ] **Step 3: Implement the new receipt contract**

```ts
export type ResumenCorreoPago = {
  montoRecibidoCentavos: number;
  totalPagadoCentavos: number;
  totalReservaCentavos: number;
  saldoPendienteCentavos: number;
};
```

Render four labeled rows and derive subject/header from `saldoPendienteCentavos`. Preserve reservation identity and pre-check-in link.

- [ ] **Step 4: Fix webhook callers**

For `MANUAL_PAGO`, use the actual Checkout Session amount as `montoRecibidoCentavos`, reload the persisted ledger after the transaction, and pass accumulated/total/pending values. Do the same for public and group receipts, allocating group totals according to the existing group rules. Never pass `reserva.totalMxn` as `montoRecibido`.

The `MANUAL_PAGO` webhook transaction must acquire the same `pg_advisory_xact_lock(hashtextextended(reservaId, 19))` used by external-payment writes before recalculating or inserting. This is what makes the concurrent Stripe/external-payment E2E scenario deterministic.

- [ ] **Step 5: Implement external receipt failure handling**

Persist the external payment first. If `enviarComprobante` is false, store `NO_SOLICITADO`. If true, set `PENDIENTE`, attempt send outside the financial transaction, then set `ENVIADO` or `FALLIDO`. Sanitize errors to a fixed user-safe message; log the detailed server error without secrets.

- [ ] **Step 6: Verify and commit**

Run: `cd app && npm test -- src/lib/emailsPago.test.ts src/app/api/webhooks/stripe/route.test.ts src/app/api/webhooks/stripe/route.direct.test.ts`  
Expected: PASS, including the $3,000-of-$6,000 regression.

```bash
git add app/src/emails/ConfirmacionReserva.tsx app/src/lib/emails.ts app/src/lib/emailsPago.test.ts app/src/app/api/webhooks/stripe/route.ts app/src/app/api/webhooks/stripe/route.test.ts app/src/app/api/webhooks/stripe/route.direct.test.ts app/src/lib/negocio/pagosExternos.server.ts
git commit -m "fix: send accurate partial payment receipts"
```

---

### Task 5: Server Actions and auditable ledger UI

**Files:**
- Create: `app/src/app/(panel)/panel/reservas/[id]/PagoLedger.tsx`
- Create: `app/src/app/(panel)/panel/reservas/[id]/PagoExternoDialog.tsx`
- Create: `app/src/app/(panel)/panel/reservas/[id]/AccionesPagoExterno.tsx`
- Create: `app/src/app/(panel)/panel/reservas/[id]/PagoLedger.test.ts`
- Create: `app/src/app/(panel)/panel/reservas/pagosExternosActions.ts`
- Modify: `app/src/app/(panel)/panel/reservas/[id]/page.tsx`
- Delete: `app/src/app/(panel)/panel/reservas/[id]/PagoForm.tsx`
- Modify: `app/src/app/(panel)/panel/reservas/actions.ts`

**Interfaces:**
- Consumes: service methods from Task 3 and receipt retry from Task 4.
- Produces Server Actions: `registrarPagoExternoAction`, `corregirPagoExternoAction`, `ajustarPagoExternoAction`, `reenviarComprobantePagoExternoAction`.
- Produces UI props containing integer centavos, formatted only at render boundaries.

- [ ] **Step 1: Write failing view-model tests**

Test a $6,000 reservation with one $3,000 Stripe movement:

```ts
expect(crearVistaLedger(input)).toMatchObject({
  estado: "Pago parcial",
  totalPagado: "$3,000 MXN",
  saldoPendiente: "$3,000 MXN",
  puedeRegistrarExterno: true,
});
expect(crearVistaLedger(input).movimientos[0]).toMatchObject({ fuente: "Stripe", editable: false });
```

Test `FINANZAS` returns `puedeRegistrarExterno: false` and no mutation controls. Test adjusted external rows remain visible.

- [ ] **Step 2: Run and verify RED**

Run: `cd app && npm test -- 'src/app/(panel)/panel/reservas/[id]/PagoLedger.test.ts'`  
Expected: FAIL because the ledger view does not exist.

- [ ] **Step 3: Implement server actions with opaque idempotency keys**

Forms send reservation/payment IDs and raw user fields only. The action obtains `getCurrentUsuario()`, constructs `ActorPagoExterno`, validates allowed enum/money/date/note lengths, and calls the service. Generate idempotency keys on dialog open with `crypto.randomUUID()` and persist one key across retries.

- [ ] **Step 4: Implement the summary and movement list**

Render total, paid, pending, and derived badge. Stripe rows say `Conciliado automáticamente por Stripe`. External rows show method, date, author, note, receipt status, and their linked adjustments. Never render the legacy dropdown.

- [ ] **Step 5: Implement the external-payment dialog**

Fields: exact amount capped visually at the server-provided balance, method, local date/time, optional note, and checked-by-default `Enviar comprobante al huésped`. Keep server validation authoritative. Show pending state and the returned success/error message.

- [ ] **Step 6: Implement correction, annulment, refund, and resend controls**

- Correction shows old values, requires reason, and creates replacement values.
- Annulment requires reason and explicit confirmation that it only changes Roomly's record.
- Refund requires amount and reason and states that the hotel must return external money itself.
- Resend appears only for `FALLIDO` or `ENVIADO` receipts and does not call payment registration.

- [ ] **Step 7: Replace legacy page section**

Load `PagoOnline`, `PagoExterno.ajustes`, and actor display data; pass a normalized ledger view to `PagoLedger`. Remove `actualizarPagoYNotasAction` and delete `PagoForm.tsx` only after no imports remain. Keep reservation-wide internal notes in the dedicated notes-only action; do not attach them to a payment implicitly.

- [ ] **Step 8: Verify and commit**

Run: `cd app && npm test -- 'src/app/(panel)/panel/reservas/[id]/PagoLedger.test.ts' && npm run lint -- 'src/app/(panel)/panel/reservas/[id]'`  
Expected: PASS and no lint errors.

```bash
git add 'app/src/app/(panel)/panel/reservas/[id]' 'app/src/app/(panel)/panel/reservas/pagosExternosActions.ts' 'app/src/app/(panel)/panel/reservas/actions.ts'
git commit -m "feat: replace manual payment status with ledger"
```

---

### Task 6: Move all balance consumers to the central summary

**Files:**
- Modify: `app/src/lib/negocio/cicloDeVida.ts`
- Modify: `app/src/lib/negocio/cicloDeVida.test.ts`
- Modify: `app/src/app/(panel)/panel/reservas/actions.ts`
- Modify: `app/src/app/(panel)/panel/reservas/SolicitarPagoButton.tsx`
- Modify: `app/src/app/(panel)/panel/calendario/CalendarioGrid.tsx`
- Modify: `app/src/app/(portal)/mi-reserva/page.tsx`
- Modify: `app/src/app/api/reservas/consulta/route.ts`
- Modify: `app/src/app/api/reservas/cancelar/route.ts`
- Create: `app/src/lib/negocio/cicloDeVida.ledger.test.ts`
- Create: `app/src/app/(panel)/panel/reservas/accionesPagoLedger.test.ts`
- Create: `app/src/app/api/reservas/consulta/route.test.ts`
- Create: `app/src/app/api/reservas/cancelar/route.test.ts`

**Interfaces:**
- Consumes: `obtenerLedgerReserva` and `calcularResumenFinanciero`.
- Removes: direct reads of `PagoManual.estadoDePago` and local subtraction formulas.

- [ ] **Step 1: Add failing lifecycle and payment-request regressions**

Cover:

```ts
it("check-in acepta Stripe 3000 + transferencia 3000 para total 6000", async () => {
  mocks.resumenFinanciero.mockResolvedValue({ saldoPendienteCentavos: 0, estado: "PAGO_COMPLETO" });
  await expect(checkIn("res_1", "prop_1")).resolves.toMatchObject({ estado: "EN_CURSO" });
});

it("check-in rechaza un saldo reabierto por reembolso", async () => {
  mocks.resumenFinanciero.mockResolvedValue({ saldoPendienteCentavos: 100_000, estado: "PAGO_PARCIAL" });
  await expect(checkIn("res_1", "prop_1")).rejects.toThrow("$1,000");
});

it("solicitar pago cobra solo el saldo central", async () => {
  mocks.resumenFinanciero.mockResolvedValue({ saldoPendienteCentavos: 300_000, estado: "PAGO_PARCIAL" });
  await solicitarPagoAction(formDataReserva("res_1"));
  expect(mocks.crearDirectCharge).toHaveBeenCalledWith(expect.objectContaining({ montoCentavos: 300_000 }));
});

it("una reserva con movimientos no se puede eliminar", () => {
  expect(tieneEliminacionSegura({ tienePagosStripe: false, tienePagosExternos: true, grupoPagadoCentavos: 0 })).toBe(false);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `cd app && npm test -- src/lib/negocio/cicloDeVida.test.ts src/app/api/reservas/checkout.test.ts`  
Expected: at least one new regression fails against legacy `PagoManual` logic.

- [ ] **Step 3: Replace lifecycle calculations**

Use one server-side loader to fetch both ledgers and calculate the summary. `checkIn`, safe deletion, and cancellation must consume its result. Cancellation of a reservation does not automatically claim an external refund; it only displays/records external refund actions separately.

- [ ] **Step 4: Replace payment-link calculations**

`solicitarPagoAction` takes no client amount. Under the existing advisory lock, recalculate pending balance and create Checkout for exactly that amount. Retain the `<= 0.005` MXN fully-paid guard at the boundary after centavo conversion.

- [ ] **Step 5: Update calendar and guest-facing read models**

Show the derived status and exact pending amount. Remove any assumption that `totalMxn` means paid revenue. Guest cancellation calculations use net Stripe for Stripe refunds and display external payments/refunds separately.

- [ ] **Step 6: Verify and commit**

Run: `cd app && npm test -- src/lib/negocio/cicloDeVida.test.ts src/app/api/reservas/checkout.test.ts src/app/api/reservas/consulta/route.test.ts src/app/api/reservas/cancelar/route.test.ts`  
Expected: PASS.

```bash
git add app/src/lib/negocio/cicloDeVida.ts app/src/lib/negocio/cicloDeVida.test.ts 'app/src/app/(panel)/panel/reservas' 'app/src/app/(panel)/panel/calendario/CalendarioGrid.tsx' 'app/src/app/(portal)/mi-reserva/page.tsx' app/src/app/api/reservas
git commit -m "fix: use financial ledger across reservation lifecycle"
```

---

### Task 7: Net-payment reports

**Files:**
- Create: `app/src/lib/negocio/reportePagos.ts`
- Create: `app/src/lib/negocio/reportePagos.test.ts`
- Modify: `app/src/app/(panel)/panel/reportes/page.tsx`

**Interfaces:**
- Consumes: normalized Stripe/external movement rows and role-gated page access.
- Produces: totals by source/method and period based on payment dates, not reservation total.

- [ ] **Step 1: Write failing report tests**

```ts
it("suma ingresos por fecha y fuente del movimiento", () => {
  expect(resumirMovimientos(periodo, movimientos)).toEqual({
    stripeCentavos: 300_000,
    efectivoCentavos: 100_000,
    transferenciaCentavos: 200_000,
    terminalExternaCentavos: 0,
    otrosCentavos: 0,
    netoCentavos: 600_000,
  });
});
it("resta reembolsos en la fecha del reembolso", () => {
  expect(resumirMovimientos(periodoAgosto, [
    { fecha: new Date("2026-08-10T12:00:00Z"), fuente: "TRANSFERENCIA", montoCentavos: 200_000 },
    { fecha: new Date("2026-08-11T12:00:00Z"), fuente: "TRANSFERENCIA", montoCentavos: -50_000 },
  ])).toMatchObject({ transferenciaCentavos: 150_000, netoCentavos: 150_000 });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `cd app && npm test -- src/lib/negocio/reportePagos.test.ts`  
Expected: FAIL because `resumirMovimientos` does not exist.

- [ ] **Step 3: Implement report normalization and UI**

Query payment movements in the selected period, normalize to signed centavos, and group by method. Replace `reservas.reduce(totalMxn)` revenue calculations. Keep occupancy metrics reservation-based and label them separately from collected revenue.

- [ ] **Step 4: Verify and commit**

Run: `cd app && npm test -- src/lib/negocio/reportePagos.test.ts && npm run lint -- 'src/app/(panel)/panel/reportes/page.tsx'`  
Expected: PASS.

```bash
git add app/src/lib/negocio/reportePagos.ts app/src/lib/negocio/reportePagos.test.ts 'app/src/app/(panel)/panel/reportes/page.tsx'
git commit -m "fix: report collected revenue from payment movements"
```

---

### Task 8: Backfill, reconciliation, feature flag, and runbook

**Files:**
- Create: `app/scripts/migrate-external-payment-ledger.ts`
- Create: `app/scripts/migrate-external-payment-ledger.test.ts`
- Create: `docs/runbooks/external-payment-ledger-rollout.md`
- Modify: `app/vercel.json` only if the project documents non-secret feature flags there; otherwise configure the flag in Vercel without committing environment values.

**Interfaces:**
- Consumes: `clasificarPagoManualLegacy`, Prisma models, and central summary.
- Produces: `.external-payment-ledger-report.json` with restrictive `0600` permissions.
- Supports: dry-run default, `--apply`, and refusal to apply without an explicit sandbox acknowledgement.

- [ ] **Step 1: Write failing reconciliation tests**

Test that the report classifies rows as `CONCILIABLE`, `SIN_MOVIMIENTO`, `REVISION_MANUAL`, `YA_MIGRADO`, or `APLICADO`; applying twice must create no duplicate payments.

- [ ] **Step 2: Run and verify RED**

Run: `cd app && npm test -- scripts/migrate-external-payment-ledger.test.ts`  
Expected: FAIL because the script/report builder does not exist. If Vitest's include pattern excludes `scripts`, move the pure report builder test to `src/lib/negocio/migracionPagosExternos.test.ts` and keep the CLI thin.

- [ ] **Step 3: Implement dry-run-first migration CLI**

Follow `scripts/reconcile-stripe-ledger.ts`: load env without printing it; reject Live Stripe unless `--allow-live`; require `--apply --sandbox-confirmed` for writes; use deterministic idempotency key `legacy-pago-manual:<pagoManualId>`; emit only IDs, classifications, and centavo amounts.

- [ ] **Step 4: Write the rollout runbook**

Document exact commands:

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_DIRECT_URL" --file "/safe/path/roomly-before-external-ledger.dump"
cd app
npx prisma migrate deploy
node --experimental-strip-types scripts/migrate-external-payment-ledger.ts
node --experimental-strip-types scripts/migrate-external-payment-ledger.ts --apply --sandbox-confirmed
```

Document comparison criteria: zero unexplained balance differences, zero duplicate idempotency keys, zero rows outside property ownership, and manual review completed before setting `PAGOS_EXTERNOS_LEDGER_ENABLED=true`.

- [ ] **Step 5: Verify and commit**

Run: `cd app && npm test -- src/lib/negocio/migracionPagosExternos.test.ts && npm run lint -- scripts/migrate-external-payment-ledger.ts`  
Expected: PASS.

```bash
git add app/scripts/migrate-external-payment-ledger.ts app/src/lib/negocio/migracionPagosExternos.test.ts docs/runbooks/external-payment-ledger-rollout.md
git commit -m "chore: add external ledger migration safeguards"
```

---

### Task 9: End-to-end sandbox acceptance and final verification

**Files:**
- Create: `app/src/app/api/webhooks/stripe/external-ledger.e2e.test.ts`
- Modify: `docs/runbooks/external-payment-ledger-rollout.md`
- Modify: `app/src/lib/negocio/pagosOnline.test.ts`
- Modify: `app/src/lib/negocio/cicloDeVida.ledger.test.ts`
- Modify: `app/src/app/api/webhooks/stripe/route.test.ts`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: executable evidence for the acceptance criteria and a recorded sandbox checklist.

- [ ] **Step 1: Add E2E acceptance scenarios**

Cover these real database flows:

1. Stripe $3,000 on a $6,000 reservation → `PAGO_PARCIAL`, email values 3k/3k/6k/3k.
2. Add external transfer $2,000 → accumulated $5,000, pending $1,000.
3. Double-submit the same external form → one payment row.
4. Concurrent Stripe $1,000 and external $1,000 when only $1,000 remains → only one path claims the balance; the other returns a deterministic conflict and no overpayment persists.
5. Correct the $2,000 transfer to $1,500 → original annulled, replacement visible, pending recalculated.
6. External refund and later Stripe refund → exact reopened balance.
7. `FINANZAS` direct mutation attempt → denied with zero writes.
8. Receipt failure → payment persists as `FALLIDO`; resend changes only receipt state.

- [ ] **Step 2: Run E2E against the isolated PostgreSQL test database**

Run: `cd app && DATABASE_URL_E2E="$SAFE_E2E_DATABASE_URL" npm test -- src/app/api/webhooks/stripe/external-ledger.e2e.test.ts`  
Expected: all scenarios PASS. Never point `DATABASE_URL_E2E` at production.

- [ ] **Step 3: Run complete verification**

Run:

```bash
cd app
npm test
npx tsc --noEmit
npm run lint
npx next build --webpack
```

Expected: zero failing tests, zero type errors, zero lint errors, production build exit 0.

- [ ] **Step 4: Perform sandbox manual acceptance**

With `PAGOS_EXTERNOS_LEDGER_ENABLED=true` only in sandbox, execute the eight E2E business flows through the UI and Stripe test Checkout. Capture reservation IDs, Stripe test PaymentIntent IDs, email subjects, displayed balances, and adjustment IDs in the runbook; do not copy secrets or guest personal data.

- [ ] **Step 5: Review and commit final evidence**

Use `/review` against the commit before Task 1, with the approved spec as the Spec axis. Resolve all financial/security findings, rerun Step 3, then commit only the runbook/test changes:

```bash
git add app/src/app/api/webhooks/stripe/external-ledger.e2e.test.ts docs/runbooks/external-payment-ledger-rollout.md
git commit -m "test: verify external payment ledger in sandbox"
```

Do not enable Stripe Live. Leave production external writes disabled until the user separately authorizes rollout after reviewing the reconciliation report and sandbox evidence.
