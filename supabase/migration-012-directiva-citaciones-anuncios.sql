-- ============================================
-- MIGRACIÓN 012 - Asambleas de directiva (privadas),
-- citaciones masivas y módulo de Anuncios
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

-- ---------- Tipo "directiva" de asamblea (privada, no la ven parceleros) ----------
alter table asambleas drop constraint asambleas_tipo_check;
alter table asambleas add constraint asambleas_tipo_check
  check (tipo in ('ordinaria','extraordinaria','directiva'));

-- Evitar citar dos veces a la misma parcela en la misma asamblea
create unique index asamblea_asistentes_unico
  on asamblea_asistentes(asamblea_id, parcela_id)
  where parcela_id is not null;

-- RLS de refuerzo: ocultar asambleas de directiva y su contenido a no-comité
-- (la app ya filtra en las APIs; esto es defensa en profundidad)
drop policy if exists "asambleas_lectura" on asambleas;
create policy "asambleas_lectura" on asambleas for select
  using (tipo <> 'directiva' or es_comite());

drop policy if exists "asistentes_lectura" on asamblea_asistentes;
create policy "asistentes_lectura" on asamblea_asistentes for select
  using (exists (
    select 1 from asambleas a where a.id = asamblea_asistentes.asamblea_id
    and (a.tipo <> 'directiva' or es_comite())
  ));

drop policy if exists "acuerdos_lectura" on asamblea_acuerdos;
create policy "acuerdos_lectura" on asamblea_acuerdos for select
  using (exists (
    select 1 from asambleas a where a.id = asamblea_acuerdos.asamblea_id
    and (a.tipo <> 'directiva' or es_comite())
  ));

drop policy if exists "documentos_lectura" on documentos;
create policy "documentos_lectura" on documentos for select
  using (
    asamblea_id is null or exists (
      select 1 from asambleas a where a.id = documentos.asamblea_id
      and (a.tipo <> 'directiva' or es_comite())
    )
  );

-- ---------- ANUNCIOS (tipo Buk: fotos, documentos, like/dislike) ----------
create table anuncios (
  id uuid primary key default uuid_generate_v4(),
  comunidad_id uuid references comunidades(id),
  titulo text not null,
  contenido text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table anuncio_archivos (
  id uuid primary key default uuid_generate_v4(),
  anuncio_id uuid not null references anuncios(id) on delete cascade,
  tipo text not null check (tipo in ('foto','documento')),
  url text not null,
  nombre text,
  created_at timestamptz default now()
);

create table anuncio_reacciones (
  id uuid primary key default uuid_generate_v4(),
  anuncio_id uuid not null references anuncios(id) on delete cascade,
  parcela_id uuid not null references parcelas(id) on delete cascade,
  tipo text not null check (tipo in ('like','dislike')),
  created_at timestamptz default now(),
  unique(anuncio_id, parcela_id)
);

alter table anuncios enable row level security;
alter table anuncio_archivos enable row level security;
alter table anuncio_reacciones enable row level security;

create policy "anuncios_lectura" on anuncios for select to authenticated using (true);
create policy "anuncio_archivos_lectura" on anuncio_archivos for select to authenticated using (true);
create policy "anuncio_reacciones_lectura" on anuncio_reacciones for select to authenticated using (true);
