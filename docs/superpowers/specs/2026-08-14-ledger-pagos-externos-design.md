# Ledger de pagos externos y estados financieros derivados

Fecha: 2026-08-14  
Estado: aprobado en conversación; pendiente de aprobación del documento

## Problema

Roomly mezcla actualmente dos conceptos distintos:

- pagos conciliados automáticamente por Stripe;
- un estado manual editable (`PENDIENTE`, `ANTICIPO_PAGADO`, `PAGADO_COMPLETO`).

El estado manual puede contradecir el ledger de Stripe, duplicar importes y ocultar saldos. Además, el correo de confirmación usa el precio total de la reserva bajo la etiqueta “Total pagado”, incluso cuando Stripe recibió solo un anticipo.

## Objetivos

1. Representar cada cobro Stripe y cada cobro externo como movimientos distintos y trazables.
2. Derivar automáticamente `Sin pagos`, `Pago parcial` y `Pago completo`; ningún usuario podrá elegir esos estados.
3. Permitir que Admin y Reservaciones registren, corrijan, anulen y documenten pagos externos.
4. Permitir que Finanzas consulte el ledger y su historial sin modificarlo.
5. Mostrar y comunicar siempre importe del movimiento, acumulado, total de reserva y saldo pendiente.
6. Conservar la separación de responsabilidad: Roomly registra pagos externos, pero no mueve ni reembolsa ese dinero.

## Fuera de alcance

- Procesar efectivo, transferencias o cargos de terminal externa.
- Verificar automáticamente que un pago externo ocurrió.
- Cambiar el modelo de direct charges de Stripe Connect.
- Permitir que Roomly retenga fondos.
- Crear un sistema contable de doble partida o facturación fiscal.

## Modelo de dominio

### Fuentes de pago

- `PagoOnline`: ledger automático de Stripe. Sigue siendo propiedad del webhook y no es editable desde el panel.
- `PagoExterno`: cobro declarado por el hotel. Cada fila representa un movimiento recibido independiente.
- `AjustePagoExterno`: efecto posterior vinculado a un `PagoExterno`, con tipo `ANULACION` o `REEMBOLSO`.

No se eliminarán movimientos financieros. Una corrección anula el movimiento equivocado y crea su reemplazo dentro de la misma transacción.

### PagoExterno

Campos mínimos:

- `id`
- `reservaId`
- `propiedadId`
- `montoMxn` decimal positivo
- `metodo`: `EFECTIVO`, `TRANSFERENCIA`, `TERMINAL_EXTERNA`, `OTRO`
- `fechaPago`
- `nota` opcional
- `creadoPorUsuarioId`
- `creadoEn`
- `idempotencyKey` única
- `reemplazaPagoExternoId` opcional, para correcciones
- estado de comprobante: pendiente, enviado o fallido
- fecha y detalle sanitizado del último intento de comprobante

### AjustePagoExterno

Campos mínimos:

- `id`
- `pagoExternoId`
- `tipo`: `ANULACION` o `REEMBOLSO`
- `montoMxn`
- `motivo` obligatorio
- `creadoPorUsuarioId`
- `creadoEn`
- `idempotencyKey` única

Una anulación revierte todo el saldo vigente del movimiento original. Un reembolso puede ser parcial o total y nunca puede exceder el saldo externo disponible.

### Estado financiero derivado

Para cada reserva:

```text
stripeNeto = cobros Stripe conciliados - reembolsos Stripe confirmados o reservados
externoNeto = pagos externos - anulaciones - reembolsos externos
pagadoNeto = min(totalReserva, max(0, stripeNeto + externoNeto))
saldoPendiente = max(0, totalReserva - pagadoNeto)
```

El estado mostrado será:

- `SIN_PAGOS` si `pagadoNeto` es cero;
- `PAGO_PARCIAL` si hay pago y saldo pendiente;
- `PAGO_COMPLETO` si el saldo es menor a medio centavo.

El estado operativo de la reserva (`PENDIENTE_PAGO`, `CONFIRMADA`, `EN_CURSO`, etc.) permanece separado del estado financiero.

## Autorización

- `ADMIN` y `SUPER_ADMIN`: registrar, corregir, anular, reembolsar y reenviar comprobantes externos.
- `RESERVACIONES`: las mismas capacidades operativas sobre pagos externos.
- `FINANZAS`: solo lectura del ledger, historial y reportes.

Cada Server Action revalidará autenticación, pertenencia de la reserva a la propiedad y rol. La interfaz no será el límite de seguridad.

## Escrituras, concurrencia e idempotencia

Toda mutación financiera externa se ejecutará en una transacción y tomará un advisory lock por `reservaId` antes de:

1. volver a leer Stripe neto y pagos externos vigentes;
2. recalcular el saldo;
3. validar importe y permisos;
4. insertar el movimiento y su auditoría.

El importe de un nuevo cobro externo no puede superar el saldo pendiente. Los reembolsos y anulaciones no pueden superar el saldo disponible del movimiento original. Las claves de idempotencia evitan duplicados por doble clic, reintento o respuesta lenta.

## Experiencia de usuario

La sección “Pago y notas” se reemplazará por un resumen y un ledger:

- total de la reserva;
- total neto pagado;
- saldo pendiente;
- estado financiero derivado;
- lista cronológica de cobros Stripe, cobros externos, anulaciones y reembolsos.

Cada fila identificará fuente, importe, fecha y estado. Los pagos externos mostrarán método, autor y nota. Los pagos Stripe se marcarán como “Conciliado automáticamente por Stripe” y no ofrecerán edición.

Admin y Reservaciones verán `Registrar pago externo`. El formulario solicitará:

- importe exacto;
- método;
- fecha y hora;
- nota opcional;
- casilla `Enviar comprobante al huésped`, activada por defecto.

Corregir exigirá motivo y mostrará explícitamente que Roomly anulará el movimiento original y creará otro. Anular y reembolsar también exigirán confirmación y motivo. Finanzas verá los mismos datos sin controles de escritura.

## Correos

El correo deja de usar “Total pagado” para representar el precio de la reserva. Para cada movimiento incluirá:

- `Pago recibido ahora`;
- `Total pagado acumulado`;
- `Total de la reserva`;
- `Saldo pendiente`.

Si queda saldo, el asunto y encabezado dirán `Anticipo recibido`. Si el saldo llega a cero, dirán `Pago completado`. La reserva puede estar confirmada aun cuando el estado financiero sea parcial.

Los pagos externos enviarán comprobante si la casilla está activa. Un fallo de email nunca revierte el movimiento financiero: se registra como `FALLIDO`, se muestra al usuario y se permite reintentar. El reintento de correo no vuelve a registrar el pago.

## Migración

La migración será aditiva:

1. crear nuevas tablas y enums;
2. transformar cada `PagoManual` con dinero recibido en un `PagoExterno` inicial;
3. conservar notas, importe y fecha disponible;
4. marcar el autor como migración del sistema cuando no pueda atribuirse;
5. comparar saldos anteriores y nuevos antes de habilitar escrituras;
6. mantener `PagoManual` en modo compatibilidad de solo lectura durante una versión;
7. retirar su uso en UI, lifecycle, solicitud de pago y reportes en el mismo despliegue funcional.

Los registros `PENDIENTE` sin importe no se convierten en pagos. `PAGADO_COMPLETO` sin importe explícito se convierte por el importe no cubierto por Stripe en el momento de la migración, evitando duplicar cobros.

## Reportes y consumidores

Detalle de reserva, check-in, solicitud de pago, cancelaciones, reportes y correos consumirán un único servicio de resumen financiero. Ninguno recalculará el saldo con lógica local propia.

Los reportes de ingresos usarán pagos netos conciliados dentro del periodo, no el precio total de todas las reservas. Se distinguirán Stripe, efectivo, transferencia, terminal externa y otros.

## Casos límite obligatorios

- pago Stripe parcial seguido de uno o varios pagos externos;
- pago externo concurrente con webhook Stripe;
- doble envío del formulario;
- intento de cobrar más que el saldo;
- corrección de importe o método;
- anulación de una captura errónea;
- reembolso externo parcial y total;
- reembolso Stripe después de completar el saldo externamente;
- correo fallido y reenvío sin duplicar pago;
- usuario Finanzas intentando mutar mediante petición directa;
- reserva cancelada o completada;
- importes con precisión de centavos;
- datos legacy inconsistentes durante migración.

Las reservas canceladas, `NO_SHOW` o completadas no aceptarán nuevos cobros externos ordinarios. Podrán registrar reembolsos sobre movimientos existentes si el rol está autorizado.

## Pruebas y aceptación

### Pruebas unitarias

- cálculo neto combinado y estado financiero;
- límites de cobros, anulaciones y reembolsos;
- permisos por rol;
- contenido semántico del correo parcial y completo;
- transformación de datos legacy.

### Pruebas de integración

- transacción concurrente webhook/pago externo;
- idempotencia de doble envío;
- corrección atómica mediante anulación y reemplazo;
- email fallido conserva el movimiento y permite reenvío;
- solicitud Stripe cobra únicamente el saldo derivado.

### Criterios de aceptación

1. No existe un dropdown editable de estado financiero.
2. Stripe y pagos externos aparecen como movimientos distintos.
3. Saldo, check-in, links de pago, reportes y correos coinciden con el mismo resumen.
4. Ningún rol puede superar sus permisos mediante llamada directa.
5. Ninguna corrección elimina historial.
6. Un correo parcial nunca afirma que el precio completo fue pagado.
7. Un fallo de correo no pierde ni duplica un movimiento.
8. La migración produce un reporte de conciliación sin diferencias no explicadas.

## Despliegue seguro

1. respaldo verificado de base de datos;
2. migración aditiva y backfill en sandbox;
3. reporte de conciliación por reserva;
4. suite completa y pruebas E2E de Stripe sandbox;
5. despliegue con escritura externa deshabilitada por feature flag;
6. verificación de lectura en producción;
7. habilitación gradual para Admin/Reservaciones;
8. monitoreo de diferencias de saldo, duplicados y fallos de correo.

No se habilitará Stripe Live como parte de este cambio.
