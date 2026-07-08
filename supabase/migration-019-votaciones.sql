-- Tabla de votaciones
create table if not exists votaciones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  tipo_conteo text not null check (tipo_conteo in ('unica', 'multiple')), -- única opción o múltiples
  es_secreta boolean not null default true, -- si es falso, se registra quién votó qué
  visibilidad_resultados text not null default 'solo_al_cerrar' check (visibilidad_resultados in ('solo_al_cerrar', 'en_vivo', 'en_vivo_comite')),
  fecha_inicio timestamp with time zone not null,
  fecha_cierre timestamp with time zone not null,
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  asamblea_id uuid, -- opcional, para vincular a un acta
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  foreign key (asamblea_id) references asambleas(id) on delete set null
);

-- Tabla de opciones de votación
create table if not exists opciones_votacion (
  id uuid primary key default gen_random_uuid(),
  votacion_id uuid not null,
  texto text not null,
  foto_url text, -- URL a Storage (opcional)
  orden integer not null, -- orden de despliegue
  created_at timestamp with time zone default now(),
  foreign key (votacion_id) references votaciones(id) on delete cascade,
  unique(votacion_id, orden)
);

-- Tabla de votos (1 por parcela + votación)
create table if not exists votos (
  id uuid primary key default gen_random_uuid(),
  votacion_id uuid not null,
  parcela_id uuid not null,
  opcion_id uuid, -- nullable para votos en blanco; si es multiple, se guarda como JSON array en opcion_ids
  opcion_ids uuid[], -- para tipo_conteo='multiple'
  votado_en timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  foreign key (votacion_id) references votaciones(id) on delete cascade,
  foreign key (parcela_id) references parcelas(id) on delete cascade,
  foreign key (opcion_id) references opciones_votacion(id) on delete set null,
  unique(votacion_id, parcela_id) -- un solo voto por parcela + votación
);

-- Índices
create index if not exists idx_votaciones_estado on votaciones(estado);
create index if not exists idx_votaciones_fecha_cierre on votaciones(fecha_cierre);
create index if not exists idx_opciones_votacion_id on opciones_votacion(votacion_id);
create index if not exists idx_votos_votacion_id on votos(votacion_id);
create index if not exists idx_votos_parcela_id on votos(parcela_id);
create index if not exists idx_votos_votacion_parcela on votos(votacion_id, parcela_id);
