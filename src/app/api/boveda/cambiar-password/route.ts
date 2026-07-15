import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion, esSuperadmin } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

const AMBITOS = ['general', 'tecnico']

// Cambia la contraseña maestra: el cliente ya desenvolvió la vault key con la
// contraseña ANTIGUA y la volvió a envolver con la NUEVA, todo en el navegador.
// Aquí solo reemplazamos el envoltorio guardado; el respaldo de recuperación
// (que usa la misma vault key, sin cambios) sigue funcionando igual.
export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { ambito, salt_maestra, iv_maestra, vault_key_wrapped_maestra } = body

  if (!AMBITOS.includes(ambito)) return NextResponse.json({ error: 'Ámbito inválido' }, { status: 400 })
  if (ambito === 'tecnico' && !esSuperadmin(sesion)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  if (!salt_maestra || !iv_maestra || !vault_key_wrapped_maestra) {
    return NextResponse.json({ error: 'Faltan datos de cifrado' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('boveda_vaults')
    .update({ salt_maestra, iv_maestra, vault_key_wrapped_maestra, updated_at: new Date().toISOString() })
    .eq('ambito', ambito)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'cambiar_password_boveda', 'boveda', ambito)
  return NextResponse.json({ ok: true })
}
