-- Mensajería vecinal: reclamos, denuncias, sugerencias y felicitaciones al comité
create table if not exists mensajes (
  id uuid primary key default gen_random_uuid(),
  parcela_id uuid not null references parcelas(id) on delete cascade,
  tipo text not null check (tipo in ('reclamo', 'denuncia', 'sugerencia', 'felicitacion')),
  asunto text not null,
  mensaje text not null,
  estado text not null default 'abierto' check (estado in ('abierto', 'respondido', 'cerrado')),
  leido_parcelero boolean not null default true,
  leido_comite boolean not null default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Hilo de respuestas: permite réplicas de ambos lados (comité y parcelero)
create table if not exists mensaje_respuestas (
  id uuid primary key default gen_random_uuid(),
  mensaje_id uuid not null references mensajes(id) on delete cascade,
  autor_tipo text not null check (autor_tipo in ('comite', 'parcelero')),
  usuario_id uuid references auth.users(id),
  autor_nombre text,
  respuesta text not null,
  created_at timestamp with time zone default now()
);

create index if not exists idx_mensajes_parcela_id on mensajes(parcela_id);
create index if not exists idx_mensajes_estado on mensajes(estado);
create index if not exists idx_mensajes_leido_comite on mensajes(leido_comite);
create index if not exists idx_mensaje_respuestas_mensaje_id on mensaje_respuestas(mensaje_id);
