# Despliegue del ledger de pagos externos

Este procedimiento migra `PagoManual` al ledger de pagos externos. Se ejecuta primero en sandbox y mantiene `PAGOS_EXTERNOS_LEDGER_ENABLED` distinto de `true` hasta que el reporte haya sido revisado y aprobado.

## 1. Preparación y respaldo

Confirma que `DATABASE_DIRECT_URL` apunta al sandbox previsto y que las credenciales de Stripe, si están presentes, son de prueba. No copies credenciales, datos de huéspedes ni notas de reservas al reporte o a la evidencia operativa.

Genera un respaldo antes de desplegar la migración:

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_DIRECT_URL" --file "/safe/path/roomly-before-external-ledger.dump"
```

Verifica que el archivo exista, no esté vacío y que `pg_restore --list "/safe/path/roomly-before-external-ledger.dump"` pueda leer su catálogo. Conserva el respaldo en una ubicación cifrada y con acceso restringido.

## 2. Esquema y dry-run

Con la escritura del feature deshabilitada, despliega las migraciones aditivas y genera el reporte sin escribir movimientos:

```bash
cd app
npx prisma migrate deploy
node --experimental-strip-types scripts/migrate-external-payment-ledger.ts
```

El modo predeterminado es `DRY_RUN`: consulta la base y escribe únicamente `.external-payment-ledger-report.json`; no crea pagos externos. El archivo se crea con permisos `0600` y contiene solo IDs, clasificaciones y cantidades en centavos. Comprueba los permisos con `stat -f '%Lp' .external-payment-ledger-report.json` en macOS o `stat -c '%a' .external-payment-ledger-report.json` en Linux.

Revisa cada `REVISION_MANUAL` antes de continuar. `SIN_MOVIMIENTO` no crea un movimiento; `YA_MIGRADO` identifica la clave determinística ya presente; `CONCILIABLE` es elegible para el backfill.

## 3. Criterios de conciliación

No apliques ni habilites el feature hasta confirmar:

- cero diferencias de saldo sin explicación (`diferenciaCentavos` debe ser cero o quedar documentada y resuelta);
- cero claves de idempotencia duplicadas;
- cero filas cuya Reserva y PagoExterno pertenezcan a Propiedades distintas;
- revisión manual completada para todas las filas `REVISION_MANUAL`;
- los totales por clasificación y centavos del reporte coinciden con la consulta de control.

El reporte no sustituye la revisión del respaldo ni la comparación independiente de los saldos antes y después.

## 4. Aplicación en sandbox

La escritura exige el acknowledgement exacto `--sandbox-confirmed`:

```bash
node --experimental-strip-types scripts/migrate-external-payment-ledger.ts --apply --sandbox-confirmed
```

No ejecutes este paso contra Stripe Live. El script no llama a Stripe; aun así, rechaza una `STRIPE_SECRET_KEY` Live salvo que exista el guard explícito `--allow-live`, que no forma parte de este procedimiento. Cada pago usa `legacy-pago-manual:<pagoManualId>` como clave de idempotencia y una segunda aplicación no crea duplicados.

Conserva el reporte `APPLY`, vuelve a ejecutar el dry-run y confirma que las filas aplicadas aparezcan como `YA_MIGRADO`, sin nuevas filas `CONCILIABLE` inesperadas. Repite los criterios de conciliación y registra la aprobación, la fecha y los IDs revisados, nunca secretos ni datos personales.

## 5. Habilitación y reversa

Despliega la aplicación con `PAGOS_EXTERNOS_LEDGER_ENABLED` deshabilitado. Solo después de revisar el reporte, completar la comparación y aprobar el sandbox, configura en el entorno correspondiente:

```text
PAGOS_EXTERNOS_LEDGER_ENABLED=true
```

Tras habilitarlo, monitorea diferencias de saldo, conflictos de idempotencia y fallos de comprobantes. Si aparece una diferencia no explicada, deshabilita nuevamente el feature, conserva los reportes y detén nuevas escrituras. No borres movimientos para revertir: usa los mecanismos de ajuste del ledger y restaura el respaldo únicamente mediante el procedimiento operativo aprobado.

## 6. Aceptación en sandbox y evidencia

La aceptación automatizada usa exclusivamente una base PostgreSQL desechable. El test queda omitido si falta cualquiera de estos tres valores o si el sentinel normalizado no coincide exactamente con el destino E2E. También se omite si `DATABASE_URL` apunta a la misma instancia normalizada.

```bash
cd app
export DATABASE_URL_E2E='postgresql://usuario:clave@host-e2e:5432/roomly_e2e'
export PAGOS_EXTERNOS_E2E_ISOLATED=true
export PAGOS_EXTERNOS_E2E_SENTINEL='postgresql://host-e2e:5432/roomly_e2e'
npm test -- src/app/api/webhooks/stripe/external-ledger.e2e.test.ts
```

El sentinel no incluye credenciales, parámetros ni schema: debe ser exactamente `postgresql://host:puerto/base`. Antes de ejecutar, confirma que la base sea desechable, tenga el esquema de prueba actualizado y no comparta destino con `DATABASE_URL`. Este test simula Stripe Test y el proveedor de correo; no usa Stripe Live ni envía mensajes reales.

Ejecuta además las regresiones focalizadas:

```bash
cd app
npm test -- \
  src/lib/negocio/pagosOnline.test.ts \
  src/lib/negocio/cicloDeVida.ledger.test.ts \
  src/app/api/webhooks/stripe/route.test.ts
```

Registra evidencia sin secretos ni datos personales. No marques un escenario como aprobado hasta observar su resultado en el sandbox:

- [ ] Stripe $3,000 sobre una reserva de $6,000 deja `PAGO_PARCIAL` y el comprobante muestra recibido $3,000, acumulado $3,000, total $6,000 y pendiente $3,000.
- [ ] Una transferencia externa de $2,000 deja acumulado $5,000 y pendiente $1,000.
- [ ] Repetir el mismo envío externo conserva una sola fila para la clave de idempotencia.
- [ ] La carrera Stripe/externo por el último $1,000 tiene un solo ganador; el perdedor obtiene el conflicto previsto o un reembolso íntegro, y el neto nunca supera $6,000.
- [ ] Corregir la transferencia de $2,000 a $1,500 conserva el original anulado, muestra el reemplazo y recalcula $500 pendientes.
- [ ] Un reembolso externo seguido de un reembolso Stripe reabre exactamente el saldo esperado.
- [ ] `FINANZAS` no puede mutar el ledger y no deja pagos ni ajustes nuevos.
- [ ] Un fallo del comprobante conserva el pago en `FALLIDO`; el reenvío modifica únicamente el estado y metadatos del comprobante.

Para la aceptación manual, registra fecha, reserva de sandbox, PaymentIntent de Stripe Test, asunto del correo, saldos observados y ajuste generado. Estado de evidencia al publicar este runbook: **pendiente de ejecución contra sandbox aislado**; una omisión segura del test no cuenta como aprobación E2E.
