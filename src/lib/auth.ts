import { cookies } from 'next/headers'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const SUPLANTAR_COOKIE = 'suplantar_parcela_id'

export interface Sesion {
  userId: string
  rol: 'comite' | 'parcelero'
  parcelaId: string | null
  nombre: string | null
  cargo: string | null
  esSuperadmin: boolean
  // Si el comité está suplantando a una parcela, contiene sus datos.
  // Mientras está activo, rol/parcelaId arriba quedan como los de esa parcela.
  suplantando: { parcelaId: string; numero: number; nombreDueno: string } | null
}

// Identifica al usuario actual, su rol, cargo y su parcela (si es parcelero).
// Si el comité activó "suplantar", esta función devuelve una sesión efectiva
// como si fuera esa parcela (para poder votar, enviar mensajes, subir lecturas, etc.
// en su nombre), pero conserva userId/nombre reales para la bitácora.
export async function getSesion(): Promise<Sesion | null> {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return null

  const service = createServiceClient()
  const [{ data: perfil }, { data: parcelaPropia }] = await Promise.all([
    service.from('perfiles').select('rol, nombre, cargo, es_superadmin').eq('id', user.id).single(),
    service.from('parcelas').select('id').eq('user_id', user.id).maybeSingle(),
  ])

  const rolReal: 'comite' | 'parcelero' = perfil?.rol === 'comite' ? 'comite' : 'parcelero'

  let rol = rolReal
  let parcelaId = parcelaPropia?.id ?? null
  let suplantando: Sesion['suplantando'] = null

  // Solo un comité real puede tener suplantación activa (la cookie sola no basta)
  if (rolReal === 'comite') {
    const cookieStore = await cookies()
    const suplantarId = cookieStore.get(SUPLANTAR_COOKIE)?.value
    if (suplantarId) {
      const { data: parcelaSuplantada } = await service
        .from('parcelas')
        .select('id, numero, nombre_dueno')
        .eq('id', suplantarId)
        .maybeSingle()
      if (parcelaSuplantada) {
        rol = 'parcelero'
        parcelaId = parcelaSuplantada.id
        suplantando = {
          parcelaId: parcelaSuplantada.id,
          numero: parcelaSuplantada.numero,
          nombreDueno: parcelaSuplantada.nombre_dueno,
        }
      }
    }
  }

  return {
    userId: user.id,
    rol,
    parcelaId,
    nombre: perfil?.nombre ?? null,
    cargo: perfil?.cargo ?? null,
    esSuperadmin: !!perfil?.es_superadmin,
    suplantando,
  }
}

// Solo el superadmin puede eliminar pagos/movimientos y cambiar contraseñas ajenas.
export function esSuperadmin(sesion: Sesion | null): boolean {
  return !!sesion && sesion.rol === 'comite' && sesion.esSuperadmin
}

// Valida que la sesión pueda operar sobre una parcela:
// el comité siempre puede; el parcelero solo sobre la suya.
export function puedeEditarParcela(sesion: Sesion, parcelaId: string): boolean {
  return sesion.rol === 'comite' || sesion.parcelaId === parcelaId
}
