-- ============================================
-- MIGRACIÓN 009 - Admins nombrados, bitácora,
-- Gastos Comunes y Asambleas/Actas
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

-- ---------- ADMINS CON NOMBRE Y CARGO ----------
alter table perfiles add column nombre text;
alter table perfiles add column cargo text check (cargo in ('presidente','tesorero','secretario','director','admin'));

-- ---------- BITÁCORA DE AUDITORÍA ----------
create table bitacora (
  id uuid primary key default uuid_generate_v4(),
  usuario_id uuid references auth.users(id),
  usuario_nombre text,
  accion text not null,
  entidad text,
  entidad_id text,
  detalle jsonb,
  created_at timestamptz default now()
);
alter table bitacora enable row level security;
create policy "comite_ve_bitacora" on bitacora for select using (es_comite());

-- ---------- GASTOS COMUNES ----------
-- Configuración: valor único mensual, igual para todas las parcelas activas
create table config_gastos_comunes (
  comunidad_id uuid primary key references comunidades(id) on delete cascade,
  valor_mensual numeric(12,2) not null default 0,
  updated_at timestamptz default now()
);
insert into config_gastos_comunes (comunidad_id) select id from comunidades;

create table periodos_gc (
  id uuid primary key default uuid_generate_v4(),
  comunidad_id uuid references comunidades(id),
  mes integer not null check (mes between 1 and 12),
  anio integer not null,
  valor_mensual numeric(12,2) not null,
  fecha_vencimiento date not null,
  fecha_corte date,
  estado text not null default 'abierto' check (estado in ('abierto','cerrado')),
  created_at timestamptz default now(),
  unique(mes, anio)
);

create table cuentas_gc (
  id uuid primary key default uuid_generate_v4(),
  periodo_gc_id uuid not null references periodos_gc(id) on delete cascade,
  parcela_id uuid not null references parcelas(id) on delete cascade,
  monto numeric(12,2) not null,
  monto_pagado numeric(12,2) not null default 0,
  estado text not null default 'pendiente' check (estado in ('pendiente','pagado','pago_parcial','mora')),
  fecha_pago date,
  observaciones text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(periodo_gc_id, parcela_id)
);

create table pagos_gc (
  id uuid primary key default uuid_generate_v4(),
  cuenta_gc_id uuid not null references cuentas_gc(id) on delete cascade,
  monto numeric(12,2) not null check (monto > 0),
  fecha date not null default current_date,
  metodo text not null default 'transferencia' check (metodo in ('transferencia','efectivo','otro')),
  observacion text,
  comprobante_url text,
  estado text not null default 'validado' check (estado in ('por_validar','validado','rechazado')),
  reportado_por uuid references auth.users(id),
  validado_por uuid references auth.users(id),
  validado_en timestamptz,
  created_at timestamptz default now()
);

alter table periodos_gc enable row level security;
alter table cuentas_gc enable row level security;
alter table pagos_gc enable row level security;

create policy "periodos_gc_lectura" on periodos_gc for select to authenticated using (true);
create policy "cuenta_gc_propia" on cuentas_gc for select using (
  parcela_id in (select id from parcelas where user_id = auth.uid())
);
create policy "comite_ve_cuentas_gc" on cuentas_gc for select using (es_comite());
create policy "pago_gc_propio" on pagos_gc for select using (
  cuenta_gc_id in (select cp.id from cuentas_gc cp join parcelas p on p.id = cp.parcela_id where p.user_id = auth.uid())
);
create policy "comite_ve_pagos_gc" on pagos_gc for select using (es_comite());

-- ---------- ASAMBLEAS / ACTAS ----------
create table asambleas (
  id uuid primary key default uuid_generate_v4(),
  comunidad_id uuid references comunidades(id),
  titulo text not null,
  tipo text not null default 'ordinaria' check (tipo in ('ordinaria','extraordinaria')),
  fecha date not null,
  hora_inicio time,
  hora_termino time,
  lugar text,
  estado text not null default 'planificada' check (estado in ('planificada','realizada','cancelada')),
  acta_url text,
  resumen text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table asamblea_asistentes (
  id uuid primary key default uuid_generate_v4(),
  asamblea_id uuid not null references asambleas(id) on delete cascade,
  parcela_id uuid references parcelas(id),
  nombre text not null,
  presente boolean not null default true,
  representado_por text,
  created_at timestamptz default now()
);

create table asamblea_acuerdos (
  id uuid primary key default uuid_generate_v4(),
  asamblea_id uuid not null references asambleas(id) on delete cascade,
  descripcion text not null,
  responsable text,
  fecha_limite date,
  estado text not null default 'pendiente' check (estado in ('pendiente','en_curso','cumplido')),
  created_at timestamptz default now()
);

create table documentos (
  id uuid primary key default uuid_generate_v4(),
  comunidad_id uuid references comunidades(id),
  asamblea_id uuid references asambleas(id) on delete set null,
  categoria text not null default 'general' check (categoria in ('acta','contable','reglamento','general')),
  nombre text not null,
  archivo_url text not null,
  subido_por uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table asambleas enable row level security;
alter table asamblea_asistentes enable row level security;
alter table asamblea_acuerdos enable row level security;
alter table documentos enable row level security;

create policy "asambleas_lectura" on asambleas for select to authenticated using (true);
create policy "asistentes_lectura" on asamblea_asistentes for select to authenticated using (true);
create policy "acuerdos_lectura" on asamblea_acuerdos for select to authenticated using (true);
create policy "documentos_lectura" on documentos for select to authenticated using (true);

-- ---------- Asignar cargos a la directiva actual ----------
-- Ejecutar manualmente reemplazando los emails reales:
-- update perfiles set nombre='Francisco Rocco', cargo='presidente' where id=(select id from auth.users where email='EMAIL_FRANCISCO');
-- update perfiles set nombre='Melissa López', cargo='tesorero' where id=(select id from auth.users where email='EMAIL_MELISSA');
-- update perfiles set nombre='Alberto Garrido', cargo='secretario' where id='f7a34073-3d24-44b5-bfb9-0b139d223db0';
