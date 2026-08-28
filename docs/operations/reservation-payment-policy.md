# Política operativa de reservas y pagos

Esta política define el comportamiento de Roomly cuando una reserva cambia de
estado o cuando se registra dinero. El estado operativo de la reserva y el
saldo financiero son independientes.

## Principios

- El saldo financiero se calcula desde movimientos conciliables: Stripe,
  pagos externos y ajustes. `PagoManual` no sustituye ese libro mayor.
- Un reembolso no cancela una reserva automáticamente. Puede ser una
  corrección, una devolución parcial o una cancelación solicitada por el
  huésped.
- Ninguna operación puede crear, editar o eliminar dinero sin actor
  autorizado, `propiedadId`, importe validado, motivo cuando corresponda e
  idempotencia.
- Los movimientos financieros son históricos: se corrigen con un nuevo
  movimiento o ajuste; no se sobrescriben ni se eliminan.

## Estados operativos

| Estado | Significado | Transiciones permitidas |
| --- | --- | --- |
| `PENDIENTE_PAGO` | Reserva creada, todavía no confirmada por pago o por una decisión del hotel. | Confirmada, cancelada, no-show (según fecha/política). |
| `CONFIRMADA` | Reserva válida y pendiente de llegada. Puede tener saldo pendiente. | En curso, cancelada, no-show. |
| `EN_CURSO` | El huésped hizo check-in. | Completada. |
| `COMPLETADA` | Se registró el checkout. | No se reabre automáticamente. |
| `CANCELADA` | El hotel o huésped canceló la reserva. | Terminal. |
| `NO_SHOW` | No se presentó dentro de la tolerancia definida. | Terminal. |

Un reembolso total deja visible la reserva como `CONFIRMADA` hasta que alguien
la cancele explícitamente. La interfaz debe mostrar una advertencia de saldo
pendiente y bloquear el check-in si no existe una autorización administrativa.

## Pagos, deuda y check-in

- `PAGO_COMPLETO`: saldo pendiente igual a cero.
- `PAGO_PARCIAL`: existe dinero aplicado, pero queda saldo pendiente.
- `SIN_PAGOS`: no existe dinero aplicado; un movimiento Stripe totalmente
  reembolsado cuenta como cero aplicado, pero permanece visible como
  reembolso.
- Por defecto no se permite check-in con saldo pendiente.
- Sólo `ADMIN` o `SUPER_ADMIN` pueden autorizar check-in con deuda, con motivo
  obligatorio de hasta 500 caracteres. La autorización queda registrada y no
  borra el saldo.
- `RESERVACIONES` puede registrar pagos externos y operar reservas según sus
  permisos; `FINANZAS` es de consulta para reservas y no puede cambiar su
  estado ni registrar movimientos.

## Cancelación, no-show y reembolsos

- Cancelar requiere una acción explícita y conserva la reserva y sus pagos.
- La política de reembolso se elige al cancelar: total, parcial o sin
  reembolso. El máximo es el importe neto cobrado por Stripe.
- Un reembolso fallido no se marca como completado; queda pendiente de
  reintento y visible para operación.
- Un reembolso parcial reduce el importe aplicado y abre sólo el saldo que
  corresponda. Nunca convierte por sí solo una reserva en cancelada.
- `NO_SHOW` se aplica únicamente después de la tolerancia configurada y no
  elimina movimientos ni decide reembolsos automáticamente.

## Auditoría mínima obligatoria

Cada mutación operativa o financiera debe registrar en un historial append-only:

- actor y rol;
- propiedad y reserva/grupo afectados;
- acción y fecha/hora;
- importe anterior y nuevo, cuando aplique;
- motivo, cuando aplique;
- identificadores de idempotencia o de Stripe, cuando existan;
- resultado (`EXITO` o `ERROR`) sin almacenar secretos ni datos completos de
  tarjeta.

Las acciones cubiertas son: cambios de fechas o importe, cancelación,
no-show, check-in con deuda, checkout, pagos externos, correcciones, ajustes,
reembolsos y cambios de grupos. Los registros no se editan ni se eliminan por
usuarios operativos.

## Casos límite

- Si un webhook llega duplicado o fuera de orden, se conserva una sola
  aplicación efectiva y se registra el intento repetido.
- Si un pago se reembolsa después de un pago externo, el saldo se recalcula
  con ambos movimientos; no se reutiliza un estado antiguo.
- Si una reserva expira sin acción, no se solicita ni cobra automáticamente un
  pago nuevo. Se marca para revisión operativa según la política de
  vencimiento y se conserva todo el historial.
- Si el importe total cambia después de un pago, se registra el importe
  anterior/nuevo y la diferencia; nunca se modifica silenciosamente el pago
  original.

