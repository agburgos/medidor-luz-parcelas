-- ============================================
-- MIGRACIÓN 002 - Comunidades y mantenedor
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

-- Tabla de comunidades (preparación multi-comunidad)
create table comunidades (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  activa boolean not null default true,
  created_at timestamptz default now()
);

-- Comunidad inicial
insert into comunidades (nombre) values ('Mi Comunidad');

-- Vincular parcelas y periodos a comunidad
alter table parcelas add column comunidad_id uuid references comunidades(id);
alter table periodos_facturacion add column comunidad_id uuid references comunidades(id);

-- Asignar todo lo existente a la comunidad inicial
update parcelas set comunidad_id = (select id from comunidades limit 1);
update periodos_facturacion set comunidad_id = (select id from comunidades limit 1);

-- Campo activa en parcelas (para desactivar sin borrar historial)
alter table parcelas add column activa boolean not null default true;

-- RLS para comunidades
alter table comunidades enable row level security;
create policy "comunidades_lectura" on comunidades for select
  to authenticated using (true);
