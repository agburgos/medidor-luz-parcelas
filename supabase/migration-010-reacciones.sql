-- ============================================
-- MIGRACIÓN 010 - Reacciones (like/dislike) a asambleas/actas
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

create table asamblea_reacciones (
  id uuid primary key default uuid_generate_v4(),
  asamblea_id uuid not null references asambleas(id) on delete cascade,
  parcela_id uuid not null references parcelas(id) on delete cascade,
  tipo text not null check (tipo in ('like','dislike')),
  created_at timestamptz default now(),
  unique(asamblea_id, parcela_id)
);

alter table asamblea_reacciones enable row level security;

create policy "reaccion_lectura" on asamblea_reacciones for select to authenticated using (true);
