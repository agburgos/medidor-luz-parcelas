-- ============================================
-- MIGRACIÓN 003 - Modelo de cobro real COPOSA
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

-- Parámetros de cobro en el período
alter table periodos_facturacion add column costo_unitario_kwh numeric(10,2) not null default 0;
alter table periodos_facturacion add column cargo_fijo numeric(10,2) not null default 5500;
alter table periodos_facturacion add column lectura_general_anterior numeric(12,2);
alter table periodos_facturacion add column lectura_general_actual numeric(12,2);
alter table periodos_facturacion add column cargo_transmision numeric(12,2) not null default 0;
alter table periodos_facturacion add column notas text;

-- Estado de la lectura por parcela
alter table lecturas add column estado text not null default 'normal'
  check (estado in ('normal','s_info','nuevo','saldo_af','desconectado'));

-- Desglose del cobro en la cuenta
alter table cuentas_parcela add column monto_consumo numeric(12,2) not null default 0;
alter table cuentas_parcela add column monto_cargo_fijo numeric(12,2) not null default 0;

-- El comité puede leer todos los datos (para dashboards y reportes)
create or replace function es_comite()
returns boolean
security definer
set search_path = public
as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'comite');
$$ language sql stable;

create policy "comite_ve_parcelas" on parcelas for select using (es_comite());
create policy "comite_ve_lecturas" on lecturas for select using (es_comite());
create policy "comite_ve_cuentas" on cuentas_parcela for select using (es_comite());
create policy "comite_ve_alertas" on alertas_enviadas for select using (es_comite());
