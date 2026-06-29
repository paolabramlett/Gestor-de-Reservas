## ADDED Requirements

### Requirement: Huésped puede buscar disponibilidad sin cuenta
El sistema SHALL permitir a cualquier visitante buscar disponibilidad ingresando fechas de llegada, salida y número de personas, sin requerir registro ni autenticación.

#### Scenario: Búsqueda con resultados disponibles
- **WHEN** el Huésped ingresa fechas válidas y número de personas
- **THEN** el sistema muestra los TiposDeHabitación disponibles con precio total del período y conteo de unidades restantes

#### Scenario: Búsqueda sin resultados
- **WHEN** no hay Disponibilidad para las fechas y personas ingresadas
- **THEN** el sistema muestra mensaje claro indicando que no hay habitaciones disponibles para esa combinación

### Requirement: Huésped puede seleccionar TipoDeHabitación y ver desglose de precio
El sistema SHALL mostrar al Huésped el desglose de precio por noche antes de proceder al pago, incluyendo noches con tarifa de Temporada y noches a TarifaBase.

#### Scenario: Reserva que cruza temporadas
- **WHEN** el Huésped selecciona un TipoDeHabitación para fechas que cruzan una Temporada
- **THEN** ve el desglose noche a noche con el total claro antes de ingresar sus datos

### Requirement: Huésped completa reserva sin crear cuenta
El sistema SHALL permitir al Huésped completar una Reserva proporcionando nombre completo, email y teléfono, sin crear una cuenta en la plataforma.

#### Scenario: Huésped ingresa datos de contacto y procede al pago
- **WHEN** el Huésped completa el formulario con nombre, email y teléfono válidos
- **THEN** el sistema lo dirige al flujo de pago de Stripe

#### Scenario: Huésped ingresa email inválido
- **WHEN** el Huésped ingresa un email con formato incorrecto
- **THEN** el sistema muestra error de validación antes de continuar

### Requirement: Portal muestra branding de la Propiedad
El sistema SHALL mostrar el nombre, logo y colores de la Propiedad en el portal público. El huésped no ve referencias a la plataforma subyacente.

#### Scenario: Huésped accede al portal de una Propiedad
- **WHEN** el Huésped accede al subdominio o URL de la Propiedad
- **THEN** ve exclusivamente la identidad visual configurada por el Admin de esa Propiedad
