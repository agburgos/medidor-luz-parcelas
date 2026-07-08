-- Vincula cada movimiento de caja con el pago que lo originó (si corresponde).
-- Al borrar un pago, su movimiento de caja se borra automáticamente (cascada),
-- evitando descuadres manuales cuando se elimina un pago duplicado/erróneo.
alter table caja_movimientos add column if not exists pago_id uuid references pagos(id) on delete cascade;
alter table caja_movimientos add column if not exists pago_gc_id uuid references pagos_gc(id) on delete cascade;

create index if not exists idx_caja_movimientos_pago_id on caja_movimientos(pago_id);
create index if not exists idx_caja_movimientos_pago_gc_id on caja_movimientos(pago_gc_id);
