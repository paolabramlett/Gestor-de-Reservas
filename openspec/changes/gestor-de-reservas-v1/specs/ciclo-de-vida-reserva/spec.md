## ADDED Requirements

### Requirement: Equipo puede ejecutar check-in
El sistema SHALL permitir al rol Reservaciones/Recepción marcar una Reserva Confirmada como EnCurso al ejecutar el check-in. El check-in requiere que la Reserva tenga AsignaciónDeHabitación.

#### Scenario: Check-in exitoso
- **WHEN** el equipo ejecuta check-in en una Reserva Confirmada con Habitación asignada
- **THEN** la Reserva pasa a estado EnCurso y la Habitación queda marcada como ocupada en el panel

#### Scenario: Intento de check-in sin Habitación asignada
- **WHEN** el equipo intenta hacer check-in en una Reserva sin AsignaciónDeHabitación
- **THEN** el sistema solicita asignar una Habitación antes de continuar

### Requirement: Equipo puede ejecutar check-out
El sistema SHALL permitir al equipo marcar una Reserva EnCurso como Completada al ejecutar el check-out. Los check-outs anticipados están permitidos y liberan la Habitación inmediatamente.

#### Scenario: Check-out en fecha programada
- **WHEN** el equipo ejecuta check-out en la fecha de salida de la Reserva
- **THEN** la Reserva pasa a Completada y la Habitación queda disponible para nuevas Reservas

#### Scenario: Check-out anticipado
- **WHEN** el equipo ejecuta check-out antes de la fecha de salida original
- **THEN** la Reserva pasa a Completada, la Habitación queda disponible inmediatamente y la Disponibilidad se actualiza en tiempo real

### Requirement: Equipo puede registrar No-Show
El sistema SHALL permitir al equipo marcar una Reserva Confirmada como NoShow cuando el Huésped no se presentó. El equipo decide explícitamente esta acción; no existe automatización.

#### Scenario: Huésped no llega y equipo registra No-Show
- **WHEN** el equipo selecciona la acción No-Show en una Reserva Confirmada
- **THEN** la Reserva pasa a estado NoShow, la Habitación asignada (si existía) queda disponible y no se genera reembolso

### Requirement: Equipo puede extender ventana de check-in
El sistema SHALL permitir al equipo mantener una Reserva Confirmada activa más allá de su fecha de llegada original cuando el Huésped avisó que llegará tarde.

#### Scenario: Equipo extiende check-in para huésped con retraso
- **WHEN** el equipo marca la Reserva como "check-in extendido" con nueva hora estimada
- **THEN** la Reserva permanece en estado Confirmada y no puede ser marcada como NoShow automáticamente

### Requirement: Equipo puede cancelar Reservas manualmente
El sistema SHALL permitir al equipo cancelar cualquier Reserva en estado Confirmada, con opción de indicar si aplica reembolso parcial, total o ninguno.

#### Scenario: Equipo cancela Reserva con reembolso parcial
- **WHEN** el equipo cancela una Reserva con PagoOnline e indica reembolso parcial
- **THEN** la Reserva pasa a Cancelada, el sistema inicia el reembolso parcial vía Stripe API y notifica al Huésped por email
