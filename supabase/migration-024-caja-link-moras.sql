-- Los abonos a moras anteriores registraban un ingreso en caja SIN vínculo
-- alguno (a diferencia de pagos de luz/GC que sí tienen pago_id/pago_gc_id).
-- Esto dejaba movimientos huérfanos si la mora se corregía o eliminaba después.
alter table caja_movimientos add column if not exists mora_id uuid references moras_anteriores(id) on delete cascade;
create index if not exists idx_caja_movimientos_mora_id on caja_movimientos(mora_id);
