-- Envío automático mensual del reporte de transparencia (recaudación, gastos,
-- saldo de caja) por correo el día 1 de cada mes, con el mismo candado de
-- modo_pruebas que las demás alertas.
alter table config_alertas add column if not exists reporte_mensual_activo boolean not null default false;
alter table config_alertas add column if not exists reporte_mensual_ultimo_enviado date;
