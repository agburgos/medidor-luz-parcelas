-- Email configurable del "dueño" de las reuniones de directiva (quien organiza
-- el evento en Google Calendar). Editable desde /comite/configuracion.
alter table config_alertas add column if not exists organizador_reunion_email text not null default 'agarridob@gmail.com';
