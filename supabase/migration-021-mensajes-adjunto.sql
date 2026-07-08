-- Adjunto opcional (foto o archivo) en mensajes y en cada respuesta del hilo
alter table mensajes add column if not exists adjunto_url text;
alter table mensaje_respuestas add column if not exists adjunto_url text;
