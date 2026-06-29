## ADDED Requirements

### Requirement: Email de confirmación al Huésped
El sistema SHALL enviar un email al Huésped inmediatamente al crearse una Reserva (por PagoOnline o PagoManual), incluyendo CódigoDeReserva, fechas, TipoDeHabitación, total pagado e instrucciones para consultar o cancelar.

#### Scenario: Reserva online confirmada
- **WHEN** Stripe confirma el PagoOnline y el sistema crea la Reserva
- **THEN** Resend envía email de confirmación al email del Huésped en menos de 60 segundos

#### Scenario: Reserva manual creada por el equipo
- **WHEN** el equipo guarda una Reserva manual
- **THEN** el sistema envía email de confirmación al Huésped con los mismos datos, indicando que el pago es gestionado directamente con el hotel

### Requirement: Email de cancelación al Huésped
El sistema SHALL enviar email al Huésped cuando su Reserva pase a estado Cancelada, indicando si aplica reembolso y el monto.

#### Scenario: Cancelación iniciada por el Huésped con reembolso
- **WHEN** el Huésped cancela dentro de la ventana permitida
- **THEN** el sistema envía email con monto reembolsado y plazo estimado de acreditación

#### Scenario: Cancelación iniciada por el equipo
- **WHEN** el equipo cancela una Reserva
- **THEN** el sistema envía email al Huésped notificando la cancelación con motivo si el equipo lo especificó

### Requirement: Recordatorio 48h antes del check-in
El sistema SHALL enviar email de recordatorio al Huésped 48 horas antes de la fecha de check-in, incluyendo datos de la Reserva y datos de contacto del hotel.

#### Scenario: Recordatorio enviado automáticamente
- **WHEN** faltan exactamente 48 horas para el check-in de una Reserva en estado Confirmada
- **THEN** Resend envía el email de recordatorio al Huésped

### Requirement: Notificación al equipo por nueva Reserva online
El sistema SHALL notificar al equipo de Reservaciones/Recepción cuando llegue una nueva Reserva online, tanto en el dashboard interno (en tiempo real) como por email.

#### Scenario: Nueva Reserva online llega
- **WHEN** se confirma una Reserva vía PagoOnline
- **THEN** el dashboard interno muestra notificación en tiempo real y se envía email de alerta a los usuarios con rol Reservaciones/Recepción y Admin

### Requirement: Emails con branding de la Propiedad
El sistema SHALL enviar todos los emails con el nombre, logo y colores de la Propiedad correspondiente. El Huésped no debe ver referencias a la plataforma subyacente.

#### Scenario: Huésped recibe email de confirmación
- **WHEN** el sistema envía cualquier email transaccional
- **THEN** el email muestra el nombre y logo de la Propiedad como remitente visual, no el nombre de la plataforma
