## Context

Sistema nuevo (greenfield). El hotel de la familia gestiona hoy reservaciones con Google Sheets + comunicación manual (WhatsApp, teléfono, correo) y pagos por transferencia bancaria confirmados por finanzas. Se reemplaza por un SaaS white-label multi-tenant con portal público para huéspedes y panel interno para el equipo.

Stack: Next.js 15 (App Router), PostgreSQL vía Supabase, Prisma ORM, Clerk (auth + multi-tenancy), Stripe (pagos), Resend + React Email (notificaciones), Vercel (deploy).

## Goals / Non-Goals

**Goals:**
- Portal público de reservas con pago online en MXN (Stripe), sin cuenta obligatoria para el huésped
- Panel interno en tiempo real para el equipo de reservaciones/recepción
- Multi-tenancy aislado por Propiedad desde el día uno (Row Level Security en PostgreSQL)
- Arquitectura white-label: cada Propiedad tiene su subdominio y branding propio
- Roles diferenciados: Admin, Reservaciones/Recepción, Finanzas/Gerencia, Super Admin

**Non-Goals:**
- App móvil nativa
- Integración con OTAs (Booking.com, Expedia, Airbnb)
- Punto de venta (restaurante, bar, amenidades)
- Housekeeping detallado
- Check-in digital con QR o llave electrónica
- WhatsApp / SMS
- Marketplace multi-hotel (v2+)
- Soporte multi-moneda en el backend (el hotel siempre recibe MXN; Stripe maneja conversión del lado del cliente)

## Decisions

### Multi-tenancy: Row Level Security + Clerk Organizations

Cada Propiedad es una Organization en Clerk. Todos los modelos de Prisma incluyen `propiedadId`. RLS en Supabase garantiza que ninguna query cruce límites de tenant, incluso ante bugs en la capa de aplicación.

*Alternativa considerada*: Bases de datos separadas por tenant. Descartada — complejidad operativa desproporcionada para v1 con pocos tenants.

### Disponibilidad: calculada en tiempo real, no almacenada

La Disponibilidad se calcula consultando Reservas activas y Bloqueos contra el inventario de Habitaciones físicas. No se persiste un contador.

*Alternativa considerada*: Tabla de disponibilidad precalculada. Descartada — introduce problemas de consistencia ante actualizaciones concurrentes. Con 26 habitaciones la query directa es trivialmente rápida.

### Prevención de overbooking: bloqueo optimista con transacción

Al confirmar una Reserva online, se ejecuta dentro de una transacción PostgreSQL: se verifica disponibilidad y se inserta la Reserva atómicamente. Si otra Reserva ganó la carrera, la transacción falla y Stripe recibe instrucción de reembolso antes de que el huésped vea error.

### Reserva sin cuenta: CódigoDeReserva + email

El Huésped no crea cuenta. Al confirmar, recibe un CódigoDeReserva único (ULID legible, ej. `RES-2025-X7K9`). Para consultar o cancelar, ingresa código + email. Clerk solo gestiona usuarios internos del hotel.

### Precio mixto por noche

El total de una Reserva es la suma de la Tarifa vigente cada noche del período (Temporada si aplica, TarifaBase como fallback). El desglose por noche se persiste en la Reserva al momento de crearla — no se recalcula después para proteger al huésped de cambios de tarifa posteriores.

*Alternativa considerada*: Tarifa del primer día para todo el período. Descartada — injusta para reservas que cruzan temporadas y difícil de auditar.

### Tiempo real: Supabase Realtime

El panel interno usa Supabase Realtime para mostrar cambios de Disponibilidad y nuevas Reservas sin polling. El portal público no necesita tiempo real — la disponibilidad se consulta en cada búsqueda.

### Email: Resend + React Email

Los emails transaccionales se componen como componentes React y se envían vía Resend. Sin servidor SMTP propio. El tier gratuito (3,000/mes) cubre el volumen inicial ampliamente.

## Risks / Trade-offs

- **Clerk lock-in** → Clerk maneja auth y multi-tenancy; migrar sería costoso. Mitigación: abstraer acceso a sesión detrás de helpers propios para no acoplar el negocio a la API de Clerk directamente.
- **Webhook de Stripe como único trigger de confirmación** → Si el webhook falla, la Reserva no se crea aunque el cobro ocurrió. Mitigación: reintentos automáticos de Stripe (hasta 72h) + endpoint idempotente con `stripe_payment_intent_id` como llave única.
- **RLS desactivado accidentalmente en migraciones** → Supabase permite desactivar RLS por tabla. Mitigación: test de integración que verifica aislamiento entre tenants en cada migration.
- **Supabase Realtime en plan gratuito** → Límite de 200 conexiones simultáneas concurrentes. Mitigación: más que suficiente para v1; escalar al plan Pro cuando sea necesario.

## Migration Plan

Sistema nuevo — no hay migración de datos existentes en v1. El hotel de la familia ingresará su inventario (Habitaciones, TiposDeHabitación, Tarifas) manualmente a través del panel de Admin al hacer onboarding.

Deploy incremental:
1. Deploy en Vercel con dominio de staging
2. Onboarding del hotel de la familia en staging (carga de inventario, pruebas de pago con Stripe test mode)
3. Switch a producción con dominio real
4. Google Sheets se mantiene en paralelo las primeras 2 semanas como respaldo, luego se depreca

## Open Questions

- ¿Qué política exacta de cancelación aplica el hotel de la familia? (ventana de horas, % de reembolso) — necesaria antes de implementar `cancelacion-por-huesped`
- ¿El CódigoDeReserva debe ser legible por humanos (ej. `RES-X7K9`) o puede ser un UUID estándar? — afecta UX del email de confirmación
- ¿Las AlertasDeTemporada van solo al Admin o a todos los usuarios internos?
