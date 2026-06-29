## ADDED Requirements

### Requirement: Equipo puede crear Reservas manuales
El sistema SHALL permitir al rol Reservaciones/Recepción crear Reservas manualmente especificando Huésped, TipoDeHabitación, fechas, número de personas, EstadoDePago y NotasDeReserva opcionales. Las Reservas manuales no pasan por Stripe.

#### Scenario: Equipo crea Reserva para convenio empresarial
- **WHEN** el equipo completa el formulario de Reserva manual con datos del Huésped y fechas
- **THEN** la Reserva queda en estado Confirmada, la Disponibilidad se actualiza en tiempo real y el sistema envía email de confirmación al Huésped

#### Scenario: Equipo intenta crear Reserva manual en fechas sin Disponibilidad
- **WHEN** el equipo selecciona un TipoDeHabitación sin Habitaciones disponibles en las fechas elegidas
- **THEN** el sistema muestra advertencia pero permite continuar (el equipo puede necesitar resolver situaciones excepcionales)

### Requirement: Equipo puede modificar Reservas existentes
El sistema SHALL permitir al rol Reservaciones/Recepción modificar NotasDeReserva y EstadoDePago de cualquier Reserva. Las fechas solo pueden modificarse contactando al equipo (no hay self-service para el Huésped).

#### Scenario: Equipo actualiza EstadoDePago a AnticipoPagado
- **WHEN** finanzas confirma la transferencia bancaria parcial y el equipo actualiza el EstadoDePago
- **THEN** el cambio queda registrado con timestamp y es visible en el reporte de finanzas

### Requirement: Equipo puede asignar Habitación física a una Reserva
El sistema SHALL permitir al equipo crear o modificar la AsignaciónDeHabitación de una Reserva en cualquier momento antes o durante el check-in.

#### Scenario: Equipo asigna Habitación antes del check-in
- **WHEN** el equipo selecciona una Habitación física disponible y la asigna a una Reserva
- **THEN** la Habitación queda vinculada a esa Reserva y visible en el panel de ocupación

#### Scenario: Reserva sin AsignaciónDeHabitación es válida
- **WHEN** existe una Reserva Confirmada sin Habitación física asignada aún
- **THEN** el sistema la muestra en el panel con indicador visual de "sin asignar" pero sin error

### Requirement: Panel muestra vista de ocupación en tiempo real
El sistema SHALL mostrar al equipo una vista de todas las Reservas activas con su estado, TipoDeHabitación, Habitación asignada (si aplica) y datos del Huésped.

#### Scenario: Equipo revisa ocupación del día
- **WHEN** el equipo accede al panel de ocupación
- **THEN** ve todas las Reservas en estado Confirmada y EnCurso ordenadas por fecha de llegada, con indicadores de llegadas y salidas del día
