-- Registra cuándo el propio parcelero aceptó el tratamiento de sus datos
-- personales al auto-registrarse (Ley 19.628 / Ley 21.719 de protección de
-- datos personales).
alter table parcelas add column if not exists consentimiento_datos_en timestamptz;
