# Gestor de Reservas

Sistema SaaS white-label de gestión hotelera multi-tenant. Permite a hoteles gestionar disponibilidad, reservas y pagos, y a clientes consultar disponibilidad, reservar y pagar en línea.

## Lenguaje

### Propiedad y habitaciones

**Propiedad**:
El hotel o establecimiento de hospedaje que usa la plataforma. Unidad raíz del modelo multi-tenant — todo dato pertenece a una Propiedad.
_Evitar_: Hotel, tenant, cuenta

**TipoDeHabitación**:
Categoría de habitación que el cliente ve, compara y reserva. Agrupa habitaciones físicas con características equivalentes (capacidad, camas, vista, amenidades). Es lo que tiene precio y disponibilidad pública.
_Evitar_: Cuarto, categoría, clase

**Habitación**:
El cuarto físico específico dentro de una Propiedad. Tiene número o nombre único. Se asigna a una Reserva por el equipo en cualquier momento antes o durante el check-in.
_Evitar_: Cuarto, unidad

### Tarifas y temporadas

**TarifaBase**:
Precio por noche siempre vigente para un TipoDeHabitación, usado cuando ninguna Temporada cubre una fecha dada. Definida por el Admin al configurar cada TipoDeHabitación. Puede ser por persona o por habitación.
_Evitar_: Precio normal, precio estándar, tarifa default

**Temporada**:
Período con fechas de inicio y fin explícitas que sobreescribe la TarifaBase con una tarifa específica. Definida manualmente por el Admin para cada año. No tiene recurrencia automática.
_Evitar_: Temporada alta, temporada baja, período

**Tarifa**:
Precio por noche aplicable a un TipoDeHabitación en una fecha concreta. Puede expresarse por persona o por habitación. El precio total de una Reserva es la suma de la Tarifa de cada noche del período.
_Evitar_: Precio, costo, rate

**AlertaDeTemporada**:
Aviso en el dashboard interno cuando existen fechas sin Temporada configurada en los próximos 90 días. Informa al equipo antes de que los clientes encuentren fechas con solo TarifaBase activa.
_Evitar_: Recordatorio, notificación de temporada

### Disponibilidad y bloqueos

**Disponibilidad**:
Conteo de Habitaciones físicas de un TipoDeHabitación que no tienen Reserva activa ni Bloqueo solapado con un rango de fechas dado. Es un valor calculado, no almacenado.
_Evitar_: Capacidad disponible, cuartos libres

**BloqueoDeHabitación**:
Impedimento manual sobre una Habitación física específica que la excluye del cálculo de Disponibilidad. Usado para mantenimiento, convenios externos o cualquier situación que saque un cuarto físico de circulación temporalmente.
_Evitar_: Bloqueo, cierre

**BloqueoDetipo**:
Impedimento manual sobre un TipoDeHabitación completo que lo oculta del portal del cliente y lo excluye del cálculo de Disponibilidad. Caso extremo que afecta todas las Habitaciones de esa categoría.
_Evitar_: Suspensión, cierre de tipo

### Huéspedes y reservas

**Huésped**:
Persona que proporciona sus datos de contacto al realizar una Reserva. No requiere cuenta en la plataforma. Se identifica con su email y el CódigoDeReserva para consultar o cancelar su Reserva.
_Evitar_: Cliente, usuario, pasajero

**CódigoDeReserva**:
Identificador único, generado al confirmar una Reserva, que permite al Huésped acceder a su Reserva sin contraseña. Se combina con el email del Huésped para autenticar acciones como consulta y cancelación.
_Evitar_: Número de confirmación, folio, ID de reserva

**Reserva**:
Compromiso confirmado de hospedaje entre un Huésped y una Propiedad. Existe únicamente una vez que el pago se confirma o el equipo la registra manualmente. No existe estado previo al pago dentro del dominio.
_Evitar_: Booking, solicitud, pedido

**AsignaciónDeHabitación**:
Vínculo entre una Reserva y una Habitación física específica. Puede crearse en cualquier momento entre la confirmación de la Reserva y el check-in. Una Reserva sin AsignaciónDeHabitación es válida.
_Evitar_: Asignación, cuarto asignado

### Estados de una Reserva

**Confirmada**:
Estado inicial de una Reserva una vez que el pago se procesa o el equipo la registra manualmente. El huésped aún no ha llegado.

**EnCurso**:
Estado de una Reserva después de que el equipo ejecuta el check-in. El huésped está hospedado actualmente.

**Completada**:
Estado final de una Reserva después de que el equipo ejecuta el check-out, incluyendo check-outs anticipados. La Habitación queda disponible inmediatamente.

**Cancelada**:
Estado de una Reserva terminada antes del check-in, ya sea por el Huésped (dentro de la política) o por el equipo. Incluye el registro de si aplica reembolso parcial o total.

**NoShow**:
Estado asignado manualmente por el equipo cuando el Huésped no llegó y el hotel decide cerrar la Reserva sin reembolso. La Habitación queda disponible para reasignación.

### Pagos

**PagoOnline**:
Pago procesado automáticamente por Stripe al momento de confirmar una Reserva desde el portal del cliente. La Reserva no existe hasta que Stripe confirma el cobro.
_Evitar_: Pago digital, pago con tarjeta

**PagoManual**:
Registro informativo de un pago externo a la plataforma (transferencia bancaria, efectivo, convenio empresarial) asociado a una Reserva creada por el equipo. El sistema no verifica ni procesa el dinero — solo registra el estado.
_Evitar_: Pago fuera de línea, pago externo

**EstadoDePago**:
Estado informativo del PagoManual de una Reserva: Pendiente, AnticipoPagado o PagadoCompleto. Solo aplica a Reservas manuales — las Reservas con PagoOnline siempre nacen pagadas.
_Evitar_: Estado de cobro, estatus de pago

**NotasDeReserva**:
Campo de texto libre asociado a una Reserva donde el equipo registra información operativa relevante (convenios, solicitudes especiales, instrucciones de facturación, etc.). No tiene estructura impuesta.
_Evitar_: Comentarios, observaciones, descripción
