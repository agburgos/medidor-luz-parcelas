-- Switches individuales por tipo de correo (reemplaza el switch único "alertas_activas"
-- para vencimiento/corte) + modo de pruebas que redirige todo a un solo correo
-- mientras el software no está liberado a los vecinos.
alter table config_alertas add column if not exists alerta_no_pago boolean not null default false;
alter table config_alertas add column if not exists alerta_corte boolean not null default false;
alter table config_alertas add column if not exists alerta_asamblea boolean not null default false;
alter table config_alertas add column if not exists alerta_votacion boolean not null default false;
alter table config_alertas add column if not exists modo_pruebas boolean not null default true;
alter table config_alertas add column if not exists email_pruebas text not null default 'agarridob@gmail.com';
