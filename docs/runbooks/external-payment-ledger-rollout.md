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
