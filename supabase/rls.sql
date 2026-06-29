-- ============================================================
-- Políticas RLS — Gestor de Reservas
-- Ejecutar en Supabase → SQL Editor
-- Nota: Prisma genera columnas en camelCase (sin @map)
-- ============================================================

-- 1. Habilitar RLS en todas las tablas
alter table propiedades                 enable row level security;
alter table usuarios_propiedad          enable row level security;
alter table tipos_de_habitacion         enable row level security;
alter table habitaciones                enable row level security;
alter table temporadas                  enable row level security;
alter table huespedes                   enable row level security;
alter table reservas                    enable row level security;
alter table asignaciones_de_habitacion  enable row level security;
alter table pagos_manuales              enable row level security;
alter table bloqueos_de_habitacion      enable row level security;
alter table bloqueos_de_tipo            enable row level security;

-- ============================================================
-- Función auxiliar: devuelve el propiedadId del usuario JWT
-- ============================================================
create or replace function get_propiedad_id()
returns text
language sql
stable
as $$
  select up."propiedadId"
  from usuarios_propiedad up
  where up."clerkUserId" = auth.uid()::text
  limit 1;
$$;

-- ============================================================
-- propiedades
-- ============================================================
drop policy if exists "propiedades_select" on propiedades;
drop policy if exists "propiedades_update" on propiedades;

create policy "propiedades_select" on propiedades
  for select using (id = get_propiedad_id());

create policy "propiedades_update" on propiedades
  for update using (id = get_propiedad_id());

-- ============================================================
-- usuarios_propiedad
-- ============================================================
drop policy if exists "usuarios_propiedad_select" on usuarios_propiedad;

create policy "usuarios_propiedad_select" on usuarios_propiedad
  for select using ("propiedadId" = get_propiedad_id());

-- ============================================================
-- tipos_de_habitacion
-- ============================================================
drop policy if exists "tipos_select" on tipos_de_habitacion;
drop policy if exists "tipos_insert" on tipos_de_habitacion;
drop policy if exists "tipos_update" on tipos_de_habitacion;
drop policy if exists "tipos_delete" on tipos_de_habitacion;

create policy "tipos_select" on tipos_de_habitacion
  for select using ("propiedadId" = get_propiedad_id());

create policy "tipos_insert" on tipos_de_habitacion
  for insert with check ("propiedadId" = get_propiedad_id());

create policy "tipos_update" on tipos_de_habitacion
  for update using ("propiedadId" = get_propiedad_id());

create policy "tipos_delete" on tipos_de_habitacion
  for delete using ("propiedadId" = get_propiedad_id());

-- ============================================================
-- habitaciones
-- ============================================================
drop policy if exists "habitaciones_select" on habitaciones;
drop policy if exists "habitaciones_insert" on habitaciones;
drop policy if exists "habitaciones_update" on habitaciones;
drop policy if exists "habitaciones_delete" on habitaciones;

create policy "habitaciones_select" on habitaciones
  for select using ("propiedadId" = get_propiedad_id());

create policy "habitaciones_insert" on habitaciones
  for insert with check ("propiedadId" = get_propiedad_id());

create policy "habitaciones_update" on habitaciones
  for update using ("propiedadId" = get_propiedad_id());

create policy "habitaciones_delete" on habitaciones
  for delete using ("propiedadId" = get_propiedad_id());

-- ============================================================
-- temporadas
-- ============================================================
drop policy if exists "temporadas_select" on temporadas;
drop policy if exists "temporadas_insert" on temporadas;
drop policy if exists "temporadas_update" on temporadas;
drop policy if exists "temporadas_delete" on temporadas;

create policy "temporadas_select" on temporadas
  for select using ("propiedadId" = get_propiedad_id());

create policy "temporadas_insert" on temporadas
  for insert with check ("propiedadId" = get_propiedad_id());

create policy "temporadas_update" on temporadas
  for update using ("propiedadId" = get_propiedad_id());

create policy "temporadas_delete" on temporadas
  for delete using ("propiedadId" = get_propiedad_id());

-- ============================================================
-- huespedes (sin propiedadId propio — acceso via reservas)
-- ============================================================
drop policy if exists "huespedes_select" on huespedes;
drop policy if exists "huespedes_insert" on huespedes;

create policy "huespedes_select" on huespedes
  for select using (
    exists (
      select 1 from reservas r
      where r."huespedId" = huespedes.id
        and r."propiedadId" = get_propiedad_id()
    )
  );

create policy "huespedes_insert" on huespedes
  for insert with check (true);

-- ============================================================
-- reservas
-- ============================================================
drop policy if exists "reservas_select" on reservas;
drop policy if exists "reservas_insert" on reservas;
drop policy if exists "reservas_update" on reservas;

create policy "reservas_select" on reservas
  for select using ("propiedadId" = get_propiedad_id());

create policy "reservas_insert" on reservas
  for insert with check ("propiedadId" = get_propiedad_id());

create policy "reservas_update" on reservas
  for update using ("propiedadId" = get_propiedad_id());

-- ============================================================
-- asignaciones_de_habitacion (acceso via reserva)
-- ============================================================
drop policy if exists "asignaciones_select" on asignaciones_de_habitacion;
drop policy if exists "asignaciones_insert" on asignaciones_de_habitacion;
drop policy if exists "asignaciones_update" on asignaciones_de_habitacion;

create policy "asignaciones_select" on asignaciones_de_habitacion
  for select using (
    exists (
      select 1 from reservas r
      where r.id = asignaciones_de_habitacion."reservaId"
        and r."propiedadId" = get_propiedad_id()
    )
  );

create policy "asignaciones_insert" on asignaciones_de_habitacion
  for insert with check (
    exists (
      select 1 from reservas r
      where r.id = asignaciones_de_habitacion."reservaId"
        and r."propiedadId" = get_propiedad_id()
    )
  );

create policy "asignaciones_update" on asignaciones_de_habitacion
  for update using (
    exists (
      select 1 from reservas r
      where r.id = asignaciones_de_habitacion."reservaId"
        and r."propiedadId" = get_propiedad_id()
    )
  );

-- ============================================================
-- pagos_manuales (acceso via reserva)
-- ============================================================
drop policy if exists "pagos_select" on pagos_manuales;
drop policy if exists "pagos_insert" on pagos_manuales;
drop policy if exists "pagos_update" on pagos_manuales;

create policy "pagos_select" on pagos_manuales
  for select using (
    exists (
      select 1 from reservas r
      where r.id = pagos_manuales."reservaId"
        and r."propiedadId" = get_propiedad_id()
    )
  );

create policy "pagos_insert" on pagos_manuales
  for insert with check (
    exists (
      select 1 from reservas r
      where r.id = pagos_manuales."reservaId"
        and r."propiedadId" = get_propiedad_id()
    )
  );

create policy "pagos_update" on pagos_manuales
  for update using (
    exists (
      select 1 from reservas r
      where r.id = pagos_manuales."reservaId"
        and r."propiedadId" = get_propiedad_id()
    )
  );

-- ============================================================
-- bloqueos_de_habitacion
-- ============================================================
drop policy if exists "bloqueos_hab_select" on bloqueos_de_habitacion;
drop policy if exists "bloqueos_hab_insert" on bloqueos_de_habitacion;
drop policy if exists "bloqueos_hab_delete" on bloqueos_de_habitacion;

create policy "bloqueos_hab_select" on bloqueos_de_habitacion
  for select using ("propiedadId" = get_propiedad_id());

create policy "bloqueos_hab_insert" on bloqueos_de_habitacion
  for insert with check ("propiedadId" = get_propiedad_id());

create policy "bloqueos_hab_delete" on bloqueos_de_habitacion
  for delete using ("propiedadId" = get_propiedad_id());

-- ============================================================
-- bloqueos_de_tipo
-- ============================================================
drop policy if exists "bloqueos_tipo_select" on bloqueos_de_tipo;
drop policy if exists "bloqueos_tipo_insert" on bloqueos_de_tipo;
drop policy if exists "bloqueos_tipo_delete" on bloqueos_de_tipo;

create policy "bloqueos_tipo_select" on bloqueos_de_tipo
  for select using ("propiedadId" = get_propiedad_id());

create policy "bloqueos_tipo_insert" on bloqueos_de_tipo
  for insert with check ("propiedadId" = get_propiedad_id());

create policy "bloqueos_tipo_delete" on bloqueos_de_tipo
  for delete using ("propiedadId" = get_propiedad_id());
