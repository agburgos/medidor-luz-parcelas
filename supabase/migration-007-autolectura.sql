-- ============================================
-- MIGRACIÓN 007 - Autolectura de medidores por parceleros
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

-- Origen y validación de las lecturas
alter table lecturas add column origen text not null default 'comite'
  check (origen in ('comite','parcelero'));
alter table lecturas add column estado_validacion text not null default 'aprobada'
  check (estado_validacion in ('pendiente','aprobada','rechazada'));
alter table lecturas add column motivo_rechazo text;

-- Fecha tope de autolectura en la configuración del macrolote
alter table config_alertas add column dia_tope_lectura integer not null default 10;
alter table config_alertas add column avisar_lectura_dias_antes integer not null default 3;

-- Nuevo tipo de alerta: recordatorio de subir lectura
alter table alertas_enviadas drop constraint alertas_enviadas_tipo_check;
alter table alertas_enviadas add constraint alertas_enviadas_tipo_check
  check (tipo in ('vencimiento','corte','lectura'));
