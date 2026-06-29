## ADDED Requirements

### Requirement: Dashboard de ocupación por período
El sistema SHALL mostrar al rol Finanzas/Gerencia (y Admin) un dashboard con tasa de ocupación por TipoDeHabitación para un rango de fechas seleccionable.

#### Scenario: Gerencia consulta ocupación del mes
- **WHEN** el usuario selecciona un rango de fechas en el dashboard
- **THEN** el sistema muestra porcentaje de ocupación por TipoDeHabitación y total de noches vendidas en el período

### Requirement: Reporte de ingresos por período
El sistema SHALL mostrar ingresos totales por período, desglosados por TipoDeHabitación y por origen (PagoOnline vs PagoManual).

#### Scenario: Finanzas consulta ingresos del trimestre
- **WHEN** el usuario selecciona un rango de fechas
- **THEN** el sistema muestra ingresos totales, desglose por tipo de habitación y separación entre pagos online y manuales

### Requirement: Lista de Reservas con filtros
El sistema SHALL permitir a los roles con acceso a reportes filtrar Reservas por estado, rango de fechas, TipoDeHabitación y origen (online/manual).

#### Scenario: Finanzas busca Reservas con pago pendiente
- **WHEN** el usuario filtra por EstadoDePago = Pendiente
- **THEN** el sistema muestra solo las Reservas manuales con pago pendiente de confirmación

### Requirement: Resumen de llegadas y salidas del día
El sistema SHALL mostrar en el dashboard interno un resumen diario de Reservas con check-in y check-out programados para hoy.

#### Scenario: Equipo revisa el día al comenzar turno
- **WHEN** cualquier usuario interno accede al dashboard
- **THEN** ve el conteo de llegadas y salidas del día con nombres de Huéspedes y TiposDeHabitación asignados
