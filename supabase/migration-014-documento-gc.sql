-- ============================================
-- MIGRACIÓN 014 - Documento adjunto por período de Gastos Comunes
-- (para que los parceleros vean/descarguen el respaldo histórico, igual que en Luz)
-- ============================================

alter table periodos_gc add column documento_url text;
