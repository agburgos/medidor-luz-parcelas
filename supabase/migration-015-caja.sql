-- Tabla de movimientos de caja (ingresos y egresos)
create table caja_movimientos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  concepto text not null,
  monto numeric(15,2) not null check (monto > 0),
  fecha date not null default current_date,
  documento_url text,
  observacion text,
  usuario_id uuid not null references auth.users(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Tabla de saldos históricos (snapshot diario o por movimiento)
create table caja_saldos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  saldo_inicial numeric(15,2),
  saldo_final numeric(15,2) not null,
  total_ingresos numeric(15,2) default 0,
  total_egresos numeric(15,2) default 0,
  created_at timestamp with time zone default now()
);

-- Índices para rendimiento
create index idx_caja_movimientos_fecha on caja_movimientos(fecha);
create index idx_caja_movimientos_tipo on caja_movimientos(tipo);
create index idx_caja_saldos_fecha on caja_saldos(fecha);

-- RLS policies
alter table caja_movimientos enable row level security;
alter table caja_saldos enable row level security;

-- Solo comité puede leer/escribir caja
create policy "comite_read_caja_movimientos" on caja_movimientos
  for select using (
    auth.jwt() ->> 'rol' = 'comite'
  );

create policy "comite_insert_caja_movimientos" on caja_movimientos
  for insert with check (
    auth.jwt() ->> 'rol' = 'comite' and
    usuario_id = auth.uid()
  );

create policy "comite_read_caja_saldos" on caja_saldos
  for select using (
    auth.jwt() ->> 'rol' = 'comite'
  );

-- Seed: saldo inicial de $169.158 al 01-07-2026
insert into caja_saldos (fecha, saldo_inicial, saldo_final)
values ('2026-07-01', 0, 169158.00);
