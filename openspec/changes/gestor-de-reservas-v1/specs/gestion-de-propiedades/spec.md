## ADDED Requirements

### Requirement: Admin puede configurar la Propiedad
El sistema SHALL permitir al Admin configurar el nombre, logo, descripción y datos de contacto de su Propiedad. Estos datos se muestran en el portal público white-label.

#### Scenario: Admin actualiza datos de la Propiedad
- **WHEN** el Admin guarda cambios en la configuración de la Propiedad
- **THEN** el portal público refleja los cambios inmediatamente

### Requirement: Admin puede crear TiposDeHabitación
El sistema SHALL permitir al Admin crear TiposDeHabitación con nombre, descripción, capacidad mínima y máxima de personas, número de Habitaciones físicas de ese tipo, fotos y amenidades.

#### Scenario: Admin crea un TipoDeHabitación
- **WHEN** el Admin completa el formulario de TipoDeHabitación y lo guarda
- **THEN** el TipoDeHabitación aparece en el portal público y en el panel interno

#### Scenario: Admin intenta crear TipoDeHabitación sin capacidad definida
- **WHEN** el Admin omite la capacidad máxima de personas
- **THEN** el sistema rechaza el formulario con mensaje de error claro

### Requirement: Admin puede registrar Habitaciones físicas
El sistema SHALL permitir al Admin registrar cada Habitación física con número o nombre único, y asociarla a un TipoDeHabitación.

#### Scenario: Admin registra una Habitación
- **WHEN** el Admin crea una Habitación con número y TipoDeHabitación
- **THEN** la Habitación queda disponible para AsignaciónDeHabitación

#### Scenario: Admin intenta registrar dos Habitaciones con el mismo número
- **WHEN** el Admin ingresa un número de Habitación ya existente en la misma Propiedad
- **THEN** el sistema rechaza el formulario con error de duplicado

### Requirement: Aislamiento de datos por Propiedad
El sistema SHALL garantizar que ningún usuario de una Propiedad pueda ver ni modificar datos de otra Propiedad.

#### Scenario: Usuario de Propiedad A intenta acceder a datos de Propiedad B
- **WHEN** cualquier query se ejecuta en la base de datos
- **THEN** Row Level Security filtra automáticamente los resultados al tenant del usuario autenticado
