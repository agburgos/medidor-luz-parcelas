#!/bin/bash
# Setup script para crear tablas de caja en Supabase

set -e

# Cargar variables de entorno
if [ ! -f .env.local ]; then
  echo "❌ Archivo .env.local no encontrado"
  exit 1
fi

URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d= -f2 | tr -d '[:space:]')
KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2 | tr -d '[:space:]')

if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "❌ Credenciales de Supabase no encontradas en .env.local"
  exit 1
fi

echo "📍 Ejecutando migración 015-caja..."
echo "URL: $URL"

# Leer el SQL
SQL=$(cat supabase/migration-015-caja.sql)

# Opción 1: Ejecutar via psql (si está disponible)
if command -v psql &> /dev/null; then
  echo "✓ Ejecutando con psql..."
  psql "$URL" -v ON_ERROR_STOP=1 << EOSQL
$SQL
EOSQL
  echo "✅ Migración completada!"
else
  echo "⚠️  psql no disponible. Por favor:"
  echo "1. Abre https://app.supabase.com/ → tu proyecto → SQL Editor"
  echo "2. Copia y pega el contenido de: supabase/migration-015-caja.sql"
  echo "3. Ejecuta (Cmd+Enter)"
  exit 1
fi
