## ADDED Requirements

### Requirement: Pago online procesado por Stripe
El sistema SHALL procesar PagosOnline vía Stripe. La Reserva SHALL crearse únicamente al recibir confirmación del webhook de Stripe, no al iniciar el flujo de pago.

#### Scenario: Huésped completa el pago exitosamente
- **WHEN** Stripe confirma el cobro vía webhook
- **THEN** el sistema crea la Reserva con estado Confirmada, genera el CódigoDeReserva y envía email de confirmación al Huésped

#### Scenario: Pago fallido o rechazado
- **WHEN** Stripe reporta el pago como fallido
- **THEN** no se crea ninguna Reserva y el Huésped recibe mensaje de error con opción de reintentar

### Requirement: Prevención de Reservas duplicadas por webhook
El sistema SHALL usar el `payment_intent_id` de Stripe como llave idempotente. Reintentos del webhook no crean Reservas duplicadas.

#### Scenario: Stripe reintenta webhook ya procesado
- **WHEN** el webhook de confirmación llega más de una vez para el mismo pago
- **THEN** el sistema detecta el `payment_intent_id` existente y responde 200 sin crear Reserva duplicada

### Requirement: Disponibilidad verificada atómicamente antes de confirmar
El sistema SHALL verificar y bloquear Disponibilidad dentro de la misma transacción que crea la Reserva al procesar el webhook. Si la Disponibilidad se agotó entre el inicio del checkout y la confirmación del pago, el sistema SHALL reembolsar automáticamente al Huésped.

#### Scenario: Disponibilidad agotada al momento del webhook
- **WHEN** el webhook de Stripe llega pero ya no hay Habitaciones disponibles del tipo seleccionado
- **THEN** el sistema reembolsa el cargo vía Stripe API y notifica al Huésped por email

### Requirement: Pagos en MXN con soporte de tarjetas internacionales
El sistema SHALL configurar Stripe para cobrar en MXN. Stripe maneja la conversión de moneda del lado del cliente para tarjetas internacionales.

#### Scenario: Huésped con tarjeta extranjera completa el pago
- **WHEN** un Huésped usa una tarjeta emitida fuera de México
- **THEN** Stripe procesa la transacción y el hotel recibe el monto en MXN
