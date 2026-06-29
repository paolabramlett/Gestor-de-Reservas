## ADDED Requirements

### Requirement: Huésped puede consultar su Reserva sin cuenta
El sistema SHALL permitir al Huésped consultar el estado de su Reserva ingresando su CódigoDeReserva y el email usado al reservar.

#### Scenario: Huésped consulta Reserva con credenciales correctas
- **WHEN** el Huésped ingresa CódigoDeReserva y email que coinciden con una Reserva existente
- **THEN** el sistema muestra los detalles de la Reserva: fechas, TipoDeHabitación, total pagado y estado

#### Scenario: Huésped ingresa credenciales incorrectas
- **WHEN** el CódigoDeReserva o email no coinciden con ninguna Reserva
- **THEN** el sistema muestra mensaje de error genérico sin revelar si el código o el email es el incorrecto

### Requirement: Huésped puede cancelar dentro de la ventana permitida
El sistema SHALL permitir al Huésped cancelar su Reserva si la solicitud ocurre antes del límite definido por la Propiedad (mínimo 48h antes del check-in). Fuera de la ventana, la cancelación solo es posible por el equipo.

#### Scenario: Cancelación dentro de la ventana
- **WHEN** el Huésped solicita cancelación y faltan más de 48h para el check-in
- **THEN** el sistema cancela la Reserva, inicia reembolso parcial vía Stripe (excluyendo comisiones de pasarela) y envía confirmación por email

#### Scenario: Cancelación fuera de la ventana
- **WHEN** el Huésped solicita cancelación y faltan menos de 48h para el check-in
- **THEN** el sistema informa que la cancelación ya no está disponible en el portal y sugiere contactar al hotel

### Requirement: Reembolso excluye comisiones de pasarela
El sistema SHALL calcular el reembolso de cancelaciones excluyendo las comisiones cobradas por Stripe. El monto de comisión no reembolsable SHALL mostrarse al Huésped antes de confirmar la cancelación.

#### Scenario: Huésped ve detalle del reembolso antes de confirmar
- **WHEN** el Huésped inicia el proceso de cancelación dentro de la ventana permitida
- **THEN** el sistema muestra el monto a reembolsar y el monto retenido por comisiones, requiriendo confirmación explícita antes de proceder

### Requirement: Reservas manuales no son cancelables por el Huésped en el portal
El sistema SHALL bloquear la cancelación self-service para Reservas creadas manualmente por el equipo (PagoManual). El Huésped SHALL ser dirigido a contactar al hotel.

#### Scenario: Huésped intenta cancelar Reserva manual
- **WHEN** el Huésped accede a una Reserva con PagoManual e intenta cancelarla
- **THEN** el sistema muestra mensaje indicando que debe contactar al hotel para cualquier cambio
