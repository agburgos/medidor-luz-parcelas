-- ============================================
-- MIGRACIÓN 005 - Validación de pagos y moras anteriores
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

-- Estado de validación en pagos
alter table pagos add column estado text not null default 'validado'
  check (estado in ('por_validar','validado','rechazado'));
alter table pagos add column comprobante_url text;
alter table pagos add column reportado_por uuid references auth.users(id);
alter table pagos add column validado_por uuid references auth.users(id);
alter table pagos add column validado_en timestamptz;

-- Moras/deudas anteriores al sistema (saldos iniciales por parcela)
create table moras_anteriores (
  id uuid primary key default uuid_generate_v4(),
  parcela_id uuid not null references parcelas(id) on delete cascade,
  descripcion text not null,
  monto numeric(12,2) not null check (monto > 0),
  monto_pagado numeric(12,2) not null default 0,
  estado text not null default 'pendiente' check (estado in ('pendiente','pago_parcial','pagado')),
  fecha_origen date,
  created_at timestamptz default now()
);

alter table moras_anteriores enable row level security;

create policy "mora_propia" on moras_anteriores for select using (
  parcela_id in (select id from parcelas where user_id = auth.uid())
);
create policy "comite_ve_moras" on moras_anteriores for select using (es_comite());
