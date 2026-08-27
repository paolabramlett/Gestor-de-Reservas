# Runbook de rollback de Roomly

## Cuándo usarlo

Iniciar rollback si el despliegue produce errores 5xx persistentes, falla la conexión a la base de datos, duplica pagos, no procesa webhooks o muestra saldos incorrectos.

## Pasos

1. Pausar el lanzamiento y registrar hora, URL, commit y mensaje de error.
2. En Vercel, promover el último deployment conocido como estable.
3. No borrar ni modificar pagos en Stripe manualmente durante el incidente.
4. Revisar Stripe Workbench para eventos fallidos y dejar anotados sus IDs.
5. Revisar Supabase para conexiones, errores y estado de migraciones.
6. Si hubo una migración, no ejecutar una migración inversa destructiva. Restaurar primero el código compatible y preparar una migración correctiva aditiva.
7. Confirmar con una prueba controlada: login, panel, consulta de reserva y lectura del ledger.
8. Reprocesar webhooks sólo después de confirmar que el código estable es idempotente.
9. Comunicar el incidente y conservar logs, IDs de Stripe y hora de resolución sin incluir secretos ni datos completos de tarjeta.

## Criterio de recuperación

El servicio se considera recuperado cuando las rutas críticas responden correctamente, los saldos coinciden con Stripe, no hay webhooks pendientes anómalos y el equipo puede explicar cualquier pago creado durante el incidente.
