import { createClient, createServiceClient } from '@/lib/supabase/server'

export interface Sesion {
  userId: string
  rol: 'comite' | 'parcelero'
  parcelaId: string | null
}

// Identifica al usuario actual, su rol y su parcela (si es parcelero).
export async function getSesion(): Promise<Sesion | null> {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return null

  const service = createServiceClient()
  const [{ data: perfil }, { data: parcela }] = await Promise.all([
    service.from('perfiles').select('rol').eq('id', user.id).single(),
    service.from('parcelas').select('id').eq('user_id', user.id).maybeSingle(),
  ])

  return {
    userId: user.id,
    rol: perfil?.rol === 'comite' ? 'comite' : 'parcelero',
    parcelaId: parcela?.id ?? null,
  }
}

// Valida que la sesión pueda operar sobre una parcela:
// el comité siempre puede; el parcelero solo sobre la suya.
export function puedeEditarParcela(sesion: Sesion, parcelaId: string): boolean {
  return sesion.rol === 'comite' || sesion.parcelaId === parcelaId
}
