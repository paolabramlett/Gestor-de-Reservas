## ADDED Requirements

### Requirement: Disponibilidad calculada en tiempo real
El sistema SHALL calcular la Disponibilidad de un TipoDeHabitación para un rango de fechas contando las Habitaciones físicas sin Reserva activa ni Bloqueo solapado. El resultado es un conteo, no un booleano.

#### Scenario: Huésped busca disponibilidad con habitaciones libres
- **WHEN** el Huésped ingresa un rango de fechas en el portal público
- **THEN** el sistema muestra cuántas Habitaciones quedan disponibles por TipoDeHabitación

#### Scenario: TipoDeHabitación sin Habitaciones disponibles
- **WHEN** todas las Habitaciones físicas del tipo están ocupadas o bloqueadas en el rango de fechas
- **THEN** el TipoDeHabitación no aparece como opción seleccionable para ese rango

### Requirement: Bloqueo instantáneo al confirmar Reserva
El sistema SHALL bloquear la Disponibilidad de una Habitación inmediatamente al confirmar una Reserva, usando una transacción atómica para prevenir overbooking.

#### Scenario: Dos huéspedes intentan reservar la última Habitación simultáneamente
- **WHEN** dos solicitudes de reserva compiten por la última Habitación disponible de un tipo
- **THEN** solo la primera en completar el pago obtiene la Reserva; la segunda recibe error de disponibilidad y su pago no se procesa

### Requirement: BloqueoDeHabitación por el equipo
El sistema SHALL permitir al equipo crear BloqueoDeHabitación sobre una Habitación física específica con fechas de inicio y fin y motivo (mantenimiento, convenio, etc.). El bloqueo excluye la Habitación del cálculo de Disponibilidad inmediatamente.

#### Scenario: Equipo bloquea una Habitación por mantenimiento
- **WHEN** el equipo crea un BloqueoDeHabitación para la Habitación 12 del 01 al 05 de marzo
- **THEN** la Habitación 12 no cuenta en la Disponibilidad del TipoDeHabitación para esas fechas desde ese instante

#### Scenario: BloqueoDeHabitación reduce el conteo visible en el portal
- **WHEN** existe un BloqueoDeHabitación activo para fechas buscadas por un Huésped
- **THEN** el portal muestra el conteo de Disponibilidad reducido sin exponer el motivo del bloqueo

### Requirement: BloqueoDetipo por el equipo
El sistema SHALL permitir al equipo crear BloqueoDetipo sobre un TipoDeHabitación completo, ocultándolo del portal público y excluyéndolo del cálculo de Disponibilidad para el período indicado.

#### Scenario: Equipo aplica BloqueoDetipo a Suites por renovación
- **WHEN** el equipo crea un BloqueoDetipo sobre el tipo "Suite" para todo enero
- **THEN** las Suites desaparecen del portal público durante enero y no pueden reservarse online

### Requirement: Actualización en tiempo real en el panel interno
El sistema SHALL reflejar cambios de Disponibilidad (nuevas Reservas, Bloqueos, check-outs) en el panel interno sin que el equipo recargue la página.

#### Scenario: Nueva reserva online llega mientras el equipo tiene el panel abierto
- **WHEN** un Huésped completa una reserva online
- **THEN** el panel interno del equipo actualiza el conteo de Disponibilidad en tiempo real
