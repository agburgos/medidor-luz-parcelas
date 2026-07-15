import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion, esSuperadmin } from '@/lib/auth'
import { recuperacionConfigurada } from '@/lib/vaultRecovery'

// GET: estado de las bóvedas (si ya están configuradas o no). 'tecnico' solo
// se informa a superadmin — a un comité normal ni siquiera le decimos que existe.
export async function GET() {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const ambitos = esSuperadmin(sesion) ? ['general', 'tecnico'] : ['general']

  const { data, error } = await supabase
    .from('boveda_vaults')
    .select('ambito, salt_maestra, iv_maestra, vault_key_wrapped_maestra, created_at')
    .in('ambito', ambitos)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  type FilaVault = { ambito: string; salt_maestra: string; iv_maestra: string; vault_key_wrapped_maestra: string; created_at: string }
  const filas = (data ?? []) as FilaVault[]

  const resultado: Record<string, unknown> = {
    recuperacion_configurada: recuperacionConfigurada(),
  }
  for (const amb of ambitos) {
    resultado[amb] = filas.find((v: FilaVault) => v.ambito === amb) ?? null
  }
  return NextResponse.json(resultado)
}
