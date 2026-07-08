import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { SUPLANTAR_COOKIE } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

// Verifica el rol REAL del usuario (sin aplicar ninguna suplantación activa),
// para que un comité ya suplantando pueda cambiar de parcela, y para que
// nadie que no sea superadmin pueda activar esto.
async function getRolReal() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return null
  const service = createServiceClient()
  const { data: perfil } = await service.from('perfiles').select('rol, nombre, cargo, es_superadmin').eq('id', user.id).single()
  return {
    userId: user.id,
    rol: perfil?.rol === 'comite' ? 'comite' as const : 'parcelero' as const,
    nombre: perfil?.nombre ?? null,
    cargo: perfil?.cargo ?? null,
    esSuperadmin: !!perfil?.es_superadmin,
  }
}

// POST: activar suplantación de una parcela (solo superadmin)
export async function POST(req: NextRequest) {
  const real = await getRolReal()
  if (!real || real.rol !== 'comite' || !real.esSuperadmin) {
    return NextResponse.json({ error: 'Solo el superadministrador puede suplantar parcelas' }, { status: 403 })
  }

  const { parcela_id } = await req.json()
  if (!parcela_id) return NextResponse.json({ error: 'Falta parcela_id' }, { status: 400 })

  const service = createServiceClient()
  const { data: parcela } = await service.from('parcelas').select('id, numero, nombre_dueno').eq('id', parcela_id).single()
  if (!parcela) return NextResponse.json({ error: 'Parcela no encontrada' }, { status: 404 })

  await registrar(
    { userId: real.userId, rol: 'comite', parcelaId: null, nombre: real.nombre, cargo: real.cargo, esSuperadmin: real.esSuperadmin, suplantando: null },
    'iniciar_suplantacion', 'parcela', parcela_id, { numero: parcela.numero, nombre_dueno: parcela.nombre_dueno }
  )

  const res = NextResponse.json({ ok: true, parcela })
  res.cookies.set(SUPLANTAR_COOKIE, parcela_id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 6, // 6 horas
  })
  return res
}

// DELETE: salir de la suplantación
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SUPLANTAR_COOKIE, '', { path: '/', maxAge: 0 })
  return res
}
