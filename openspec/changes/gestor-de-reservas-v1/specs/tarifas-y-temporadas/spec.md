## ADDED Requirements

### Requirement: Admin puede definir TarifaBase por TipoDeHabitación
El sistema SHALL requerir que cada TipoDeHabitación tenga una TarifaBase: precio por noche expresado por persona o por habitación. La TarifaBase aplica en cualquier fecha no cubierta por una Temporada.

#### Scenario: Admin define TarifaBase al crear TipoDeHabitación
- **WHEN** el Admin crea un TipoDeHabitación e ingresa precio y modalidad (por persona / por habitación)
- **THEN** la TarifaBase queda asociada al TipoDeHabitación y aplica como fallback

#### Scenario: Fecha sin Temporada definida
- **WHEN** un Huésped busca disponibilidad en fechas sin Temporada configurada
- **THEN** el sistema calcula el precio usando la TarifaBase de cada TipoDeHabitación

### Requirement: Admin puede crear Temporadas con fechas explícitas
El sistema SHALL permitir al Admin crear Temporadas con nombre, fecha de inicio, fecha de fin, precio por noche y modalidad (por persona o por habitación). Una Temporada sobreescribe la TarifaBase para las fechas que cubre.

#### Scenario: Admin crea Temporada Alta para diciembre
- **WHEN** el Admin define una Temporada con inicio 15-dic-2025 y fin 06-ene-2026 con tarifa por habitación
- **THEN** todas las noches en ese rango se cobran a la tarifa de Temporada, no a la TarifaBase

#### Scenario: Admin intenta crear Temporada con fechas solapadas
- **WHEN** el Admin define una Temporada cuyas fechas se solapan con una Temporada existente para el mismo TipoDeHabitación
- **THEN** el sistema rechaza la operación con mensaje que indica el conflicto

### Requirement: Precio mixto por noche en Reservas que cruzan Temporadas
El sistema SHALL calcular el total de una Reserva como la suma de la Tarifa vigente en cada noche del período, permitiendo que distintas noches tengan distinta tarifa.

#### Scenario: Reserva que cruza cambio de Temporada
- **WHEN** un Huésped reserva del 28-dic al 03-ene y la Temporada Alta termina el 31-dic
- **THEN** el sistema cobra noches 28, 29, 30-dic a tarifa de Temporada y 01, 02-ene a TarifaBase (o la Temporada que aplique)

### Requirement: Desglose de precio persiste en la Reserva
El sistema SHALL guardar el desglose de Tarifa por noche al momento de crear la Reserva. Cambios posteriores de TarifaBase o Temporadas no afectan Reservas ya confirmadas.

#### Scenario: Admin modifica TarifaBase después de una Reserva confirmada
- **WHEN** el Admin cambia el precio de TarifaBase de un TipoDeHabitación
- **THEN** las Reservas existentes mantienen el precio calculado al momento de su creación

### Requirement: AlertaDeTemporada en el dashboard interno
El sistema SHALL mostrar una alerta visible en el dashboard interno cuando existan fechas sin Temporada configurada en los próximos 90 días para cualquier TipoDeHabitación activo.

#### Scenario: Fechas próximas sin cobertura de Temporada
- **WHEN** el equipo accede al dashboard interno y hay fechas en los próximos 90 días sin Temporada
- **THEN** se muestra una alerta con las fechas afectadas y enlace para crear Temporada
