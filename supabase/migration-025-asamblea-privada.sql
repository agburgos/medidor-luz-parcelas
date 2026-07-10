-- Nuevo tipo de asamblea "privada": conversación puntual con un vecino
-- específico. A diferencia de "directiva" (solo la ve el comité), esta la ve
-- el comité y la(s) parcela(s) citada(s) únicamente.
alter table asambleas drop constraint asambleas_tipo_check;
alter table asambleas add constraint asambleas_tipo_check
  check (tipo in ('ordinaria','extraordinaria','directiva','privada'));
