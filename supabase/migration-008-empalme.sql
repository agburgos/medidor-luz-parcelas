-- ============================================
-- MIGRACIÓN 008 - Parcelas con/sin empalme eléctrico
-- Ejecutar en el SQL Editor de Supabase
-- ============================================

-- Solo las parcelas con empalme entran al cálculo de consumo y suben lecturas.
alter table parcelas add column tiene_empalme boolean not null default true;

-- Las 44 parcelas que aparecen en el reporte de consumo COPOSA tienen empalme;
-- por defecto todas quedan con empalme=true y el comité desmarca las que no.
