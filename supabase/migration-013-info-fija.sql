-- ============================================
-- MIGRACIÓN 013 - Información fija (no tipo anuncio)
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

create table informacion_fija (
  id uuid primary key default uuid_generate_v4(),
  comunidad_id uuid references comunidades(id),
  titulo text not null,
  contenido text not null,
  orden integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table informacion_fija enable row level security;
create policy "info_fija_lectura" on informacion_fija for select to authenticated using (true);
