-- Marca si un período ya tuvo su prorrateo calculado. Una vez calculado,
-- las lecturas se cierran para edición: solo un superadmin puede reabrir
-- (recalcular). También permite crear el período sin factura/lecturas,
-- ya que ahora monto_total_factura y fecha_vencimiento son opcionales
-- (se completan cuando llega la factura, antes de prorratear).
alter table periodos_facturacion add column if not exists prorrateo_calculado boolean not null default false;
alter table periodos_facturacion alter column monto_total_factura drop not null;
alter table periodos_facturacion alter column fecha_vencimiento drop not null;
