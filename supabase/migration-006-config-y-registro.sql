-- ============================================
-- MIGRACIÓN 006 - Config de alertas por macrolote + registro de personas y mascotas
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

-- Configuración de alertas por comunidad (macrolote)
create table config_alertas (
  comunidad_id uuid primary key references comunidades(id) on delete cascade,
  alertas_activas boolean not null default true,
  dias_aviso_vencimiento integer not null default 5,
  dias_aviso_corte integer not null default 3,
  frecuencia_reenvio_dias integer not null default 0, -- 0 = una sola vez; N = reenviar cada N días
  max_por_dia integer not null default 200,
  updated_at timestamptz default now()
);

insert into config_alertas (comunidad_id)
select id from comunidades;

-- Personas asociadas a cada parcela (familiares, arrendatarios, etc.)
create table personas (
  id uuid primary key default uuid_generate_v4(),
  parcela_id uuid not null references parcelas(id) on delete cascade,
  nombre text not null,
  relacion text not null default 'familiar' check (relacion in ('dueno','familiar','arrendatario','trabajador','otro')),
  rut text,
  telefono text,
  email text,
  created_at timestamptz default now()
);

-- Mascotas por parcela
create table mascotas (
  id uuid primary key default uuid_generate_v4(),
  parcela_id uuid not null references parcelas(id) on delete cascade,
  nombre text not null,
  especie text not null default 'perro' check (especie in ('perro','gato','otro')),
  raza text,
  color text,
  chip text,
  created_at timestamptz default now()
);

-- Permitir que las alertas se reenvíen: registrar última fecha
alter table alertas_enviadas add column ultima_vez timestamptz default now();

-- RLS
alter table config_alertas enable row level security;
alter table personas enable row level security;
alter table mascotas enable row level security;

create policy "comite_config" on config_alertas for select using (es_comite());

create policy "persona_propia" on personas for select using (
  parcela_id in (select id from parcelas where user_id = auth.uid())
);
create policy "comite_ve_personas" on personas for select using (es_comite());

create policy "mascota_propia" on mascotas for select using (
  parcela_id in (select id from parcelas where user_id = auth.uid())
);
create policy "comite_ve_mascotas" on mascotas for select using (es_comite());
