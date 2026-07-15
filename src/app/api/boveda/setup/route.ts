import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion, esSuperadmin } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'
import { envolverConRecovery, recuperacionConfigurada } from '@/lib/vaultRecovery'

const AMBITOS = ['general', 'tecnico']

// Crea una bóveda por primera vez. El cliente ya generó la vault key y la
// envolvió con la contraseña maestra (nunca viaja en claro); solo nos manda
// además la vault key en crudo UNA VEZ para poder armar el respaldo de
// recuperación aquí en el servidor. No se guarda en ningún lado sin envolver.
export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { ambito, salt_maestra, iv_maestra, vault_key_wrapped_maestra, vault_key_raw_b64 } = body

  if (!AMBITOS.includes(ambito)) return NextResponse.json({ error: 'Ámbito inválido' }, { status: 400 })
  if (ambito === 'tecnico' && !esSuperadmin(sesion)) return NextResponse.json({ error: 'Solo superadmin puede crear la bóveda técnica' }, { status: 403 })
  if (!salt_maestra || !iv_maestra || !vault_key_wrapped_maestra || !vault_key_raw_b64) {
    return NextResponse.json({ error: 'Faltan datos de cifrado' }, { status: 400 })
  }
  if (!recuperacionConfigurada()) {
    return NextResponse.json({ error: 'El servidor no tiene configurado VAULT_RECOVERY_SECRET' }, { status: 500 })
  }

  const supabase = createServiceClient()

  const { data: existente } = await supabase.from('boveda_vaults').select('id').eq('ambito', ambito).maybeSingle()
  if (existente) return NextResponse.json({ error: 'Esta bóveda ya fue configurada' }, { status: 409 })

  const { iv: iv_recovery, wrapped: vault_key_wrapped_recovery } = await envolverConRecovery(vault_key_raw_b64)

  const { error } = await supabase.from('boveda_vaults').insert({
    ambito,
    salt_maestra,
    iv_maestra,
    vault_key_wrapped_maestra,
    iv_recovery,
    vault_key_wrapped_recovery,
    creado_por: sesion.userId,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'crear_boveda', 'boveda', ambito)
  return NextResponse.json({ ok: true })
}
