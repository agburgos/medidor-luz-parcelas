-- Permite al comité ocultar opciones del menú (comité o parcelero) sin tocar código,
-- por ejemplo mientras una sección como "Gasto Común COPOSA" aún no está activa.
-- La presencia de una fila = esa opción está oculta para todos.
create table if not exists menu_oculto (
  href text primary key,
  ocultado_en timestamptz not null default now()
);
