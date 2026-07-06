/**
 * Script para cargar parcelas desde CSV a Supabase.
 *
 * Uso:
 *   1. Copiar .env.local.example a .env.local y completar las variables
 *   2. Editar scripts/parcelas.csv con los datos reales de las 80 parcelas
 *   3. Ejecutar: npx ts-node --project tsconfig.json scripts/seed-parcelas.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// Cargar variables de entorno manualmente
const envFile = readFileSync(join(__dirname, '../.env.local'), 'utf8')
const env: Record<string, string> = {}
envFile.split('\n').forEach(line => {
  const [k, v] = line.split('=')
  if (k && v) env[k.trim()] = v.trim()
})

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'])

async function main() {
  const csv = readFileSync(join(__dirname, 'parcelas.csv'), 'utf8')
  const lines = csv.trim().split('\n').slice(1) // skip header

  const parcelas = lines.map(line => {
    const [numero, nombre_dueno, email, telefono] = line.split(',')
    return {
      numero: parseInt(numero),
      nombre_dueno: nombre_dueno?.trim(),
      email: email?.trim(),
      telefono: telefono?.trim() || null,
    }
  }).filter(p => p.numero && p.nombre_dueno && p.email)

  console.log(`Importando ${parcelas.length} parcelas...`)

  const { data, error } = await supabase
    .from('parcelas')
    .upsert(parcelas, { onConflict: 'numero' })
    .select()

  if (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }

  console.log(`✅ ${data?.length} parcelas importadas/actualizadas`)

  // Mostrar resumen
  const sin_usuario = data?.filter(p => !p.user_id).length
  console.log(`\nResumen:`)
  console.log(`  Total parcelas: ${data?.length}`)
  console.log(`  Sin usuario vinculado: ${sin_usuario}`)
  console.log(`\nPara vincular usuarios a parcelas, los parceleros deben crear su cuenta`)
  console.log(`y el comité debe actualizar el user_id en la tabla parcelas desde Supabase.`)
}

main()
