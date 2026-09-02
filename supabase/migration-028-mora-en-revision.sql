-- Nuevo estado para congelar una mora anterior en disputa: no se muestra en
-- reportes de deudores ni en el total de deuda del dashboard/transparencia
-- (igual que 'desconectado' en cuentas_parcela), pero sin fingir que está pagada.
alter table moras_anteriores drop constraint moras_anteriores_estado_check;
alter table moras_anteriores add constraint moras_anteriores_estado_check
  check (estado in ('pendiente','pago_parcial','pagado','en_revision'));
