## 1. Infraestructura y proyecto base

- [x] 1.1 Crear proyecto Next.js 15 con App Router y TypeScript
- [ ] 1.2 Configurar Supabase: crear proyecto, habilitar RLS globalmente
- [x] 1.3 Inicializar Prisma con schema base y conexión a Supabase
- [ ] 1.4 Configurar Clerk: crear aplicación, habilitar Organizations (multi-tenant)
- [ ] 1.5 Configurar Resend: cuenta y dominio de envío verificado
- [x] 1.6 Configurar variables de entorno (.env.local con Supabase, Clerk, Stripe, Resend)
- [ ] 1.7 Deploy inicial a Vercel con variables de entorno de staging

## 2. Modelo de datos (Prisma + RLS)

- [x] 2.1 Definir modelo `Propiedad` con campos de branding (nombre, logo, slug, colores)
- [x] 2.2 Definir modelo `TipoDeHabitacion` con capacidad min/max, fotos, amenidades y TarifaBase (precio + modalidad)
- [x] 2.3 Definir modelo `Habitacion` con número/nombre único por Propiedad y relación a TipoDeHabitacion
- [x] 2.4 Definir modelo `Temporada` con fechas inicio/fin, precio, modalidad y relación a TipoDeHabitacion
- [x] 2.5 Definir modelo `Reserva` con estado, origen (online/manual), desglose de precio por noche, CódigoDeReserva y relación a Huesped
- [x] 2.6 Definir modelo `Huesped` con nombre, email, teléfono (sin cuenta Clerk)
- [x] 2.7 Definir modelo `AsignacionDeHabitacion` como relación entre Reserva y Habitacion
- [x] 2.8 Definir modelos `BloqueoDeHabitacion` y `BloqueoDetipo` con fechas y motivo
- [x] 2.9 Definir modelo `PagoManual` con EstadoDePago y NotasDeReserva
- [x] 2.10 Escribir políticas RLS en Supabase: todas las tablas filtran por `propiedad_id` del usuario autenticado
- [ ] 2.11 Test de integración: verificar aislamiento entre tenants con datos de dos Propiedades

## 3. Autenticación y roles

- [x] 3.1 Integrar Clerk con Next.js (middleware de protección de rutas internas)
- [ ] 3.2 Definir metadata de roles en Clerk Organizations: Admin, Reservaciones, Finanzas, SuperAdmin
- [x] 3.3 Crear helpers de autorización: `requireRole(role)` y `getCurrentPropiedad()`
- [x] 3.4 Implementar resolución de tenant por slug/subdominio en middleware
- [x] 3.5 Proteger rutas del panel interno según rol (Admin, Reservaciones, Finanzas)
- [ ] 3.6 Implementar panel de Super Admin con acceso transversal a Propiedades

## 4. Configuración de Propiedad (Admin)

- [x] 4.1 Página de configuración de Propiedad: nombre, logo, descripción, contacto
- [x] 4.2 CRUD de TiposDeHabitacion: formulario con capacidad, fotos, amenidades y TarifaBase
- [x] 4.3 CRUD de Habitaciones físicas: formulario con número/nombre y asociación a TipoDeHabitacion
- [x] 4.4 Validación: número de Habitación único por Propiedad
- [x] 4.5 CRUD de Temporadas: formulario con fechas, precio y modalidad
- [x] 4.6 Validación: detectar y rechazar Temporadas con fechas solapadas por TipoDeHabitacion
- [x] 4.7 AlertaDeTemporada: query de fechas sin cobertura en próximos 90 días, banner en dashboard

## 5. Cálculo de disponibilidad

- [x] 5.1 Función `calcularDisponibilidad(tipoId, fechaInicio, fechaFin)` que cuenta Habitaciones sin Reserva activa ni Bloqueo solapado
- [x] 5.2 Función `calcularTarifaPorNoche(tipoId, fecha)` que retorna Tarifa de Temporada o TarifaBase según fecha
- [x] 5.3 Función `calcularTotalReserva(tipoId, fechaInicio, fechaFin, personas)` con desglose por noche
- [x] 5.4 Endpoint `GET /api/disponibilidad` para búsquedas del portal público
- [x] 5.5 CRUD de BloqueoDeHabitacion: formulario del equipo con fechas y motivo
- [x] 5.6 CRUD de BloqueoDetipo: formulario del equipo con fechas
- [ ] 5.7 Supabase Realtime: suscripción en panel interno a cambios de Reservas y Bloqueos

## 6. Portal público de reservas

- [x] 6.1 Página principal del portal con branding de la Propiedad (resolución por slug/subdominio)
- [x] 6.2 Formulario de búsqueda: fechas llegada/salida y número de personas
- [x] 6.3 Página de resultados: lista de TiposDeHabitacion con Disponibilidad y precio total del período
- [x] 6.4 Página de detalle de TipoDeHabitacion con desglose de precio por noche
- [x] 6.5 Formulario de datos del Huésped: nombre, email, teléfono (sin cuenta)
- [x] 6.6 Integrar Stripe Checkout: crear PaymentIntent con monto calculado y metadata de la Reserva
- [x] 6.7 Página de confirmación post-pago con CódigoDeReserva

## 7. Webhooks y confirmación de Reserva

- [x] 7.1 Endpoint `POST /api/webhooks/stripe` con verificación de firma
- [x] 7.2 Handler de `payment_intent.succeeded`: verificar disponibilidad, crear Reserva atómica, generar CódigoDeReserva (ULID legible)
- [x] 7.3 Idempotencia: verificar `payment_intent_id` antes de crear Reserva para evitar duplicados en reintentos
- [x] 7.4 Handler de disponibilidad agotada en webhook: reembolso automático vía Stripe API + email al Huésped
- [x] 7.5 Handler de `payment_intent.payment_failed`: notificar al Huésped

## 8. Gestión de Reservas (panel interno)

- [x] 8.1 Vista de ocupación: tabla de Reservas activas con estado, Huésped, TipoDeHabitacion, Habitacion asignada
- [x] 8.2 Formulario de Reserva manual: Huésped, TipoDeHabitacion, fechas, personas, EstadoDePago, NotasDeReserva
- [x] 8.3 Advertencia (no bloqueo) al crear Reserva manual sin Disponibilidad
- [x] 8.4 Formulario de AsignacionDeHabitacion: selección de Habitacion física disponible para una Reserva
- [x] 8.5 Vista de llegadas y salidas del día en dashboard
- [x] 8.6 Actualización de EstadoDePago y NotasDeReserva en Reservas existentes

## 9. Ciclo de vida de Reserva (check-in / check-out / estados)

- [x] 9.1 Acción de check-in: validar AsignacionDeHabitacion, transición Confirmada → EnCurso
- [x] 9.2 Acción de check-out: transición EnCurso → Completada, liberar Habitacion inmediatamente
- [x] 9.3 Acción de No-Show: transición Confirmada → NoShow, liberar Habitacion asignada
- [x] 9.4 Acción de check-in extendido: marcar Reserva para no-auto-NoShow, registrar nueva hora estimada
- [x] 9.5 Acción de cancelación por equipo: selección de política de reembolso, transición a Cancelada, reembolso Stripe si aplica

## 10. Cancelación por Huésped (portal público)

- [x] 10.1 Página de consulta de Reserva: formulario CódigoDeReserva + email
- [x] 10.2 Validación de credenciales: error genérico si no coinciden (sin revelar cuál falló)
- [x] 10.3 Vista de detalle de Reserva para el Huésped: estado, fechas, total
- [x] 10.4 Lógica de ventana de cancelación: verificar si faltan más de 48h para check-in
- [x] 10.5 Pantalla de confirmación de cancelación: mostrar monto a reembolsar y comisión retenida
- [x] 10.6 Procesamiento de cancelación: reembolso parcial vía Stripe, transición a Cancelada
- [x] 10.7 Bloquear cancelación self-service para Reservas con PagoManual

## 11. Notificaciones por email

- [x] 11.1 Crear plantilla React Email: confirmación de Reserva (con CódigoDeReserva, fechas, total, branding)
- [x] 11.2 Crear plantilla React Email: cancelación (con monto reembolsado si aplica)
- [x] 11.3 Crear plantilla React Email: recordatorio 48h antes de check-in
- [x] 11.4 Crear plantilla React Email: alerta al equipo por nueva Reserva online
- [x] 11.5 Integrar Resend: envío de confirmación al crear Reserva (online y manual)
- [x] 11.6 Integrar Resend: envío de cancelación al cancelar Reserva (cualquier origen)
- [x] 11.7 Implementar job programado (cron o Vercel Cron): recordatorio 48h antes de check-in
- [x] 11.8 Envío de alerta al equipo en el webhook de nueva Reserva online

## 12. Reportes (panel Finanzas/Gerencia)

- [x] 12.1 Dashboard de ocupación: query de tasa por TipoDeHabitacion y período seleccionable
- [x] 12.2 Reporte de ingresos: totales por período desglosados por tipo y origen (online/manual)
- [x] 12.3 Lista de Reservas con filtros: estado, fechas, TipoDeHabitacion, origen
- [x] 12.4 Filtro por EstadoDePago para identificar Reservas manuales con pago pendiente

## 13. QA y deploy a producción

- [ ] 13.1 Tests de integración: flujo completo de reserva online (búsqueda → pago → webhook → email)
- [ ] 13.2 Tests de integración: aislamiento RLS entre dos Propiedades
- [ ] 13.3 Tests de integración: prevención de overbooking bajo concurrencia
- [ ] 13.4 Pruebas manuales con Stripe en modo test: pago exitoso, pago fallido, reembolso
- [ ] 13.5 Onboarding del hotel de la familia en staging: carga de inventario y configuración
- [ ] 13.6 Switch a Stripe producción y dominio real
- [ ] 13.7 Período de operación paralela (2 semanas): Google Sheets como respaldo
- [ ] 13.8 Deprecar Google Sheets
