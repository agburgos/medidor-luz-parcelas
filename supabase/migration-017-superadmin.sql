-- Agrega un nivel de permisos por encima de "comite": el superadmin.
-- Un superadmin siempre es comité (para efectos de RLS/es_comite()), pero
-- solo el superadmin puede eliminar pagos/movimientos de caja y cambiar
-- la contraseña de otros usuarios. El resto de comité mantiene su acceso
-- normal (validar, registrar, generar reportes) sin estas capacidades.
alter table perfiles add column if not exists es_superadmin boolean not null default false;
