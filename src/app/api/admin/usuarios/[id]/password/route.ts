import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion, esSuperadmin } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

// Cambia la contraseña de cualquier usuario (comité o parcelero). Solo superadmin.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion || !esSuperadmin(sesion)) {
    return NextResponse.json({ error: 'Solo un superadministrador puede cambiar contraseñas' }, { status: 403 })
  }

  const { id } = await params
  const { password } = await req.json()

  if (!password || String(password).length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase.auth.admin.updateUserById(id, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'cambiar_password_usuario', 'usuario', id, {})

  return NextResponse.json({ ok: true })
}
