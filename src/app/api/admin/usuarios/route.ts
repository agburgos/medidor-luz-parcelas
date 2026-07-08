import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion, esSuperadmin } from '@/lib/auth'

// Lista todos los usuarios (comité + parceleros) con su email, para que el
// superadmin pueda cambiarles la contraseña. Solo superadmin.
export async function GET() {
  const sesion = await getSesion()
  if (!sesion || !esSuperadmin(sesion)) {
    return NextResponse.json({ error: 'Solo un superadministrador puede ver esta lista' }, { status: 403 })
  }

  const supabase = createServiceClient()

  const [{ data: perfiles }, { data: parcelas }, { data: authList }] = await Promise.all([
    supabase.from('perfiles').select('id, rol, nombre, cargo, es_superadmin'),
    supabase.from('parcelas').select('user_id, numero, nombre_dueno, email'),
    supabase.auth.admin.listUsers({ perPage: 500 }),
  ])

  type ParcelaRow = { user_id: string; numero: number; nombre_dueno: string; email: string | null }
  const parcelaPorUser = new Map<string, ParcelaRow>((parcelas ?? []).map((p: ParcelaRow) => [p.user_id, p]))
  const emailPorId = new Map((authList?.users ?? []).map((u: { id: string; email?: string }) => [u.id, u.email]))

  type PerfilRow = { id: string; rol: string; nombre: string | null; cargo: string | null; es_superadmin: boolean }
  const usuarios = (perfiles ?? []).map((p: PerfilRow) => {
    const parcela = parcelaPorUser.get(p.id)
    return {
      id: p.id,
      email: emailPorId.get(p.id) ?? parcela?.email ?? null,
      rol: p.rol,
      nombre: p.nombre ?? parcela?.nombre_dueno ?? null,
      cargo: p.cargo,
      esSuperadmin: !!p.es_superadmin,
      numeroParcela: parcela?.numero ?? null,
    }
  }).sort((a: { rol: string; numeroParcela: number | null }, b: { rol: string; numeroParcela: number | null }) => {
    if (a.rol !== b.rol) return a.rol === 'comite' ? -1 : 1
    return (a.numeroParcela ?? 0) - (b.numeroParcela ?? 0)
  })

  return NextResponse.json(usuarios)
}
