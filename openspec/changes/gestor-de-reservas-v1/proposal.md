## Why

El hotel de la familia gestiona reservaciones manualmente a través de Google Sheets, WhatsApp, teléfono y correo, con confirmación de pagos vía transferencia bancaria coordinada entre finanzas y reservaciones. Este proceso fragmentado genera errores, retrasos y una experiencia deficiente para el cliente. Se construye un sistema SaaS white-label multi-tenant que reemplaza ese flujo completo, con arquitectura lista para venderse como suscripción a otros hoteles.

## What Changes

- **Nuevo sistema completo** — no existe código previo; este es el punto de partida
- Portal público para huéspedes: búsqueda de disponibilidad, reserva y pago online con Stripe
- Panel interno para el equipo: gestión de reservas manuales, asignación de habitaciones, check-in/check-out, bloqueos
- Dashboard de solo lectura para finanzas/gerencia: reportes de ocupación e ingresos
- Notificaciones por email automatizadas (confirmación, cancelación, recordatorio 48h antes)
- Arquitectura multi-tenant: cada Propiedad opera con su propia marca (white-label), aislada por Row Level Security en PostgreSQL
- Super Admin con acceso transversal a todas las Propiedades

## Capabilities

### New Capabilities

- `gestion-de-propiedades`: Configuración de la Propiedad, sus TiposDeHabitación, Habitaciones físicas y branding white-label por tenant
- `tarifas-y-temporadas`: Definición de TarifaBase por TipoDeHabitación, Temporadas con fechas explícitas, cálculo de Tarifa por noche y AlertaDeTemporada
- `disponibilidad`: Cálculo en tiempo real de Habitaciones libres por TipoDeHabitación y rango de fechas; BloqueoDeHabitación y BloqueoDetipo
- `portal-de-reservas`: Flujo público de búsqueda, selección y reserva por parte del Huésped sin cuenta requerida
- `pagos-online`: Integración con Stripe para PagoOnline en MXN; confirmación automática de Reserva al completar el cobro
- `gestion-de-reservas`: Creación y modificación manual de Reservas por el equipo (PagoManual, EstadoDePago, NotasDeReserva)
- `ciclo-de-vida-reserva`: Transiciones de estado de Reserva (Confirmada → EnCurso → Completada / Cancelada / NoShow); AsignaciónDeHabitación; check-in y check-out incluyendo anticipados
- `cancelacion-por-huesped`: Flujo de cancelación self-service para el Huésped usando CódigoDeReserva + email; política de reembolso con retención de comisión de pasarela
- `notificaciones-email`: Emails transaccionales al Huésped (confirmación, cancelación, recordatorio 48h) y alertas al equipo por nuevas reservas online
- `roles-y-permisos`: Roles Admin, Reservaciones/Recepción, Finanzas/Gerencia (solo lectura) y Super Admin con control de acceso por Propiedad
- `reportes`: Dashboard de ocupación e ingresos para Finanzas/Gerencia; métricas básicas por período

### Modified Capabilities

*(No aplica — sistema nuevo)*

## Impact

- **Stack nuevo**: Next.js 15, PostgreSQL (Supabase), Prisma, Clerk, Stripe, Resend + React Email, Vercel
- **Multi-tenancy**: Row Level Security en PostgreSQL; resolución de tenant por subdominio o slug de Propiedad
- **Pagos**: Webhooks de Stripe para confirmación asíncrona de PagoOnline
- **Tiempo real**: Supabase Realtime para actualización de Disponibilidad en el panel interno
- **Sin dependencias externas previas** — greenfield completo
