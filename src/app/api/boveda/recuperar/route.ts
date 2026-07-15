import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion, esSuperadmin } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'
import { reenvolverParaRecuperacion, recuperacionConfigurada } from '@/lib/vaultRecovery'

const AMBITOS = ['general', 'tecnico']

// Recuperación de acceso cuando se perdió la contraseña maestra. Es una
// acción sensible: solo superadmin puede iniciarla, y queda registrada en
// bitácora. El servidor desenvuelve la vault key con el secreto de
// recuperación (que nunca sale del servidor) y la vuelve a envolver con la
// clave de la NUEVA contraseña maestra, que el navegador ya derivó localmente
// y manda solo para esta operación puntual.
export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || !esSuperadmin(sesion)) return NextResponse.json({ error: 'Solo superadmin puede recuperar el acceso a la bóveda' }, { status: 403 })

  if (!recuperacionConfigurada()) {
    return NextResponse.json({ error: 'El servidor no tiene configurado VAULT_RECOVERY_SECRET' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const { ambito, nueva_salt_maestra, nuevo_iv_maestra, nueva_clave_derivada_raw_b64 } = body

  if (!AMBITOS.includes(ambito)) return NextResponse.json({ error: 'Ámbito inválido' }, { status: 400 })
  if (!nueva_salt_maestra || !nuevo_iv_maestra || !nueva_clave_derivada_raw_b64) {
    return NextResponse.json({ error: 'Faltan datos de cifrado' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: vault, error: errVault } = await supabase
    .from('boveda_vaults')
    .select('iv_recovery, vault_key_wrapped_recovery')
    .eq('ambito', ambito)
    .maybeSingle()

  if (errVault || !vault) return NextResponse.json({ error: 'La bóveda no existe' }, { status: 404 })

  let nuevoWrapped: string
  try {
    nuevoWrapped = await reenvolverParaRecuperacion(
      vault.vault_key_wrapped_recovery,
      vault.iv_recovery,
      nueva_clave_derivada_raw_b64,
      nuevo_iv_maestra
    )
  } catch {
    return NextResponse.json({ error: 'No se pudo recuperar el acceso (respaldo dañado o secreto incorrecto)' }, { status: 500 })
  }

  const { error } = await supabase
    .from('boveda_vaults')
    .update({
      salt_maestra: nueva_salt_maestra,
      iv_maestra: nuevo_iv_maestra,
      vault_key_wrapped_maestra: nuevoWrapped,
      updated_at: new Date().toISOString(),
    })
    .eq('ambito', ambito)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'recuperar_boveda', 'boveda', ambito, { motivo: 'contraseña maestra olvidada' })
  return NextResponse.json({ ok: true })
}
