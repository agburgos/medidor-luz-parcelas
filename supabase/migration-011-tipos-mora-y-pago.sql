-- ============================================
-- MIGRACIÓN 011 - Diferenciar Luz/GC en moras y pagos
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

-- Las moras anteriores ahora indican si son de luz, GC u otro concepto
alter table moras_anteriores add column tipo text not null default 'luz' check (tipo in ('luz','gc','otro'));

-- Marca si el pago fue informado como parte de un comprobante que cubre
-- ambos conceptos (luz y GC) en una sola transferencia
alter table pagos add column combinado boolean not null default false;
alter table pagos_gc add column combinado boolean not null default false;
