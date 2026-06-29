## ADDED Requirements

### Requirement: Rol Admin con control total de la Propiedad
El sistema SHALL otorgar al rol Admin acceso completo a la configuración de su Propiedad: TiposDeHabitación, Habitaciones, Tarifas, Temporadas, usuarios y branding. Un Admin solo gestiona su propia Propiedad.

#### Scenario: Admin accede a configuración de su Propiedad
- **WHEN** un usuario con rol Admin inicia sesión
- **THEN** ve y puede modificar toda la configuración de su Propiedad pero no datos de otras Propiedades

### Requirement: Rol Reservaciones/Recepción para operaciones diarias
El sistema SHALL otorgar al rol Reservaciones/Recepción permisos para: crear y modificar Reservas manuales, asignar Habitaciones, ejecutar check-in/check-out, registrar NoShow y crear Bloqueos. No puede modificar precios ni configuración de la Propiedad.

#### Scenario: Usuario de Reservaciones intenta modificar TarifaBase
- **WHEN** un usuario con rol Reservaciones/Recepción intenta acceder a la sección de Tarifas
- **THEN** el sistema deniega el acceso con mensaje de permisos insuficientes

### Requirement: Rol Finanzas/Gerencia de solo lectura
El sistema SHALL otorgar al rol Finanzas/Gerencia acceso de solo lectura a reportes de ocupación, ingresos, Reservas y estado de pagos. No puede crear ni modificar ninguna entidad.

#### Scenario: Usuario de Finanzas intenta cancelar una Reserva
- **WHEN** un usuario con rol Finanzas/Gerencia intenta ejecutar una acción de escritura
- **THEN** el sistema deniega la acción y no muestra controles de modificación en la interfaz

### Requirement: Super Admin con acceso transversal
El sistema SHALL otorgar al Super Admin (plataforma) acceso a todas las Propiedades para soporte y configuración. El Super Admin no aparece como usuario del hotel ante los huéspedes.

#### Scenario: Super Admin accede a Propiedad de cliente
- **WHEN** el Super Admin selecciona una Propiedad en el panel de administración de plataforma
- **THEN** puede ver y gestionar todos los datos de esa Propiedad como si fuera su Admin

### Requirement: Aislamiento de roles por Propiedad
El sistema SHALL garantizar que los roles se apliquen por Propiedad. Un usuario con rol Admin en la Propiedad A no tiene ningún acceso a la Propiedad B.

#### Scenario: Usuario intenta acceder a otra Propiedad
- **WHEN** un usuario autenticado intenta acceder a recursos de una Propiedad a la que no pertenece
- **THEN** el sistema deniega el acceso con 403 sin revelar información de la otra Propiedad
