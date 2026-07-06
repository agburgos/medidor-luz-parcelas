-- ============================================
-- MIGRACIÓN 004 - Registro de pagos (abonos)
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

create table pagos (
  id uuid primary key default uuid_generate_v4(),
  cuenta_id uuid not null references cuentas_parcela(id) on delete cascade,
  monto numeric(12,2) not null check (monto > 0),
  fecha date not null default current_date,
  metodo text not null default 'transferencia' check (metodo in ('transferencia','efectivo','otro')),
  observacion text,
  creado_por uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table pagos enable row level security;

-- Parcelero ve los pagos de sus propias cuentas
create policy "pago_propio" on pagos for select using (
  cuenta_id in (
    select cp.id from cuentas_parcela cp
    join parcelas p on p.id = cp.parcela_id
    where p.user_id = auth.uid()
  )
);

-- Comité ve todos
create policy "comite_ve_pagos" on pagos for select using (es_comite());
