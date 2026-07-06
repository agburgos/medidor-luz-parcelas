-- ============================================
-- SCHEMA - Sistema Medidor Luz Parcelas
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

-- Habilitar extensión para UUIDs
create extension if not exists "uuid-ossp";

-- Tabla de parcelas
create table parcelas (
  id uuid primary key default uuid_generate_v4(),
  numero integer not null unique,
  nombre_dueno text not null,
  email text not null unique,
  telefono text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Tabla de periodos de facturación
create table periodos_facturacion (
  id uuid primary key default uuid_generate_v4(),
  mes integer not null check (mes between 1 and 12),
  anio integer not null,
  monto_total_factura numeric(12,2) not null default 0,
  fecha_emision date,
  fecha_vencimiento date not null,
  fecha_corte date,
  archivo_factura_url text,
  estado text not null default 'abierto' check (estado in ('abierto','cerrado')),
  created_at timestamptz default now(),
  unique(mes, anio)
);

-- Tabla de lecturas de medidor por parcela y periodo
create table lecturas (
  id uuid primary key default uuid_generate_v4(),
  periodo_id uuid not null references periodos_facturacion(id) on delete cascade,
  parcela_id uuid not null references parcelas(id) on delete cascade,
  lectura_anterior numeric(10,2) not null default 0,
  lectura_actual numeric(10,2) not null default 0,
  consumo_kwh numeric(10,2) generated always as (lectura_actual - lectura_anterior) stored,
  foto_url text,
  confirmado boolean not null default false,
  created_at timestamptz default now(),
  unique(periodo_id, parcela_id)
);

-- Tabla de estado de cuenta por parcela y periodo
create table cuentas_parcela (
  id uuid primary key default uuid_generate_v4(),
  periodo_id uuid not null references periodos_facturacion(id) on delete cascade,
  parcela_id uuid not null references parcelas(id) on delete cascade,
  monto_prorrateado numeric(12,2) not null default 0,
  monto_pagado numeric(12,2) not null default 0,
  estado text not null default 'pendiente' check (estado in ('pendiente','pagado','pago_parcial','mora')),
  fecha_pago date,
  observaciones text,
  actualizado_por uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(periodo_id, parcela_id)
);

-- Tabla de alertas enviadas (para evitar duplicados)
create table alertas_enviadas (
  id uuid primary key default uuid_generate_v4(),
  tipo text not null check (tipo in ('vencimiento','corte')),
  periodo_id uuid not null references periodos_facturacion(id) on delete cascade,
  parcela_id uuid not null references parcelas(id) on delete cascade,
  enviado_en timestamptz default now(),
  unique(tipo, periodo_id, parcela_id)
);

-- Tabla de perfiles (extiende auth.users con rol)
create table perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  rol text not null default 'parcelero' check (rol in ('comite','parcelero')),
  created_at timestamptz default now()
);

-- Trigger para crear perfil automáticamente al registrar usuario
create or replace function handle_new_user()
returns trigger
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, rol) values (new.id, 'parcelero');
  return new;
end;
$$ language plpgsql;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Trigger para updated_at en cuentas_parcela
create or replace function set_updated_at()
returns trigger
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger cuentas_parcela_updated_at
  before update on cuentas_parcela
  for each row execute procedure set_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table parcelas enable row level security;
alter table periodos_facturacion enable row level security;
alter table lecturas enable row level security;
alter table cuentas_parcela enable row level security;
alter table alertas_enviadas enable row level security;
alter table perfiles enable row level security;

-- Políticas: el comité puede ver y editar todo (usando service role key en el backend)
-- Los parceleros solo ven sus propios datos

-- Perfiles: cada usuario ve su propio perfil
create policy "perfil_propio" on perfiles for select using (id = auth.uid());

-- Parcelas: parcelero ve solo la suya; comité ve todas (via service role)
create policy "parcela_propia" on parcelas for select
  using (user_id = auth.uid());

-- Periodos: todos los autenticados pueden leer (info pública del comité)
create policy "periodos_lectura" on periodos_facturacion for select
  to authenticated using (true);

-- Lecturas: parcelero ve solo las de su parcela
create policy "lectura_propia" on lecturas for select
  using (
    parcela_id in (select id from parcelas where user_id = auth.uid())
  );

-- Cuentas: parcelero ve solo las de su parcela
create policy "cuenta_propia" on cuentas_parcela for select
  using (
    parcela_id in (select id from parcelas where user_id = auth.uid())
  );

-- ============================================
-- DATOS INICIALES
-- ============================================

-- Usuario comité: se debe crear manualmente en Supabase Auth
-- Luego actualizar su perfil:
-- UPDATE perfiles SET rol = 'comite' WHERE id = 'uuid-del-usuario-comite';

-- Ejemplo de inserción de parcelas (ajustar con datos reales)
-- insert into parcelas (numero, nombre_dueno, email) values
--   (1, 'Juan Pérez', 'juan@email.cl'),
--   (2, 'María González', 'maria@email.cl');
-- ... hasta 80 parcelas
