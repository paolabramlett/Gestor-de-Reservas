# Checklist de producción de Roomly

## Versión candidata

- Commit candidato actual: `7eae8ad` (`feat: add audited admin check-in override`)
- Rama: `main`
- Fecha de revisión: 2026-08-27
- Base de datos: Supabase PostgreSQL
- Pagos: Stripe Connect con cobros directos a la cuenta conectada del hotel

## Variables y separación de entornos

- `DATABASE_URL`: conexión de aplicación mediante Transaction Pooler.
- `DIRECT_URL`: conexión para Prisma Migrate mediante Session Pooler o conexión directa.
- `STRIPE_SECRET_KEY`: debe pertenecer al mismo modo que el webhook activo.
- `STRIPE_WEBHOOK_SECRET`: endpoint de la cuenta plataforma.
- `STRIPE_WEBHOOK_SECRET_CONNECT`: endpoint de cuentas conectadas.
- `CRON_SECRET`: secreto para los endpoints de Vercel Cron.
- Clerk y Resend: claves de producción separadas de sandbox.

No se deben copiar secretos al repositorio, capturas, logs ni tickets. Las variables de sandbox y producción deben mantenerse separadas en Vercel.

## Puertas de salida

- [ ] RLS activado y verificado en las tablas financieras.
- [ ] Backup y restauración probados en una base aislada.
- [ ] Pool de conexiones verificado y monitorizado.
- [ ] Migraciones aplicadas antes del código que las consume.
- [ ] Webhooks con alertas, reintentos y conciliación.
- [ ] Matriz de roles y aislamiento entre propiedades aprobada.
- [ ] Políticas de cancelación, saldos y reembolsos documentadas.
- [ ] Pruebas sandbox y smoke test post-deploy aprobados.
- [ ] Primer hotel Live habilitado como piloto.
