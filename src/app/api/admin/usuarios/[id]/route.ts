import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion, esSuperadmin } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

const CARGOS_VALIDOS = ['presidente', 'tesorero', 'secretario', 'director', 'admin']

// Cambia rol/cargo/superadmin de un usuario (ej: al renovarse la directiva). Solo superadmin.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion || !esSuperadmin(sesion)) {
    return NextResponse.json({ error: 'Solo un superadministrador puede editar perfiles' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const update: Record<string, unknown> = {}

  if (body.rol !== undefined) {
    if (!['comite', 'parcelero'].includes(body.rol)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 })
    }
    update.rol = body.rol
  }
  if (body.cargo !== undefined) {
    if (body.cargo !== null && !CARGOS_VALIDOS.includes(body.cargo)) {
      return NextResponse.json({ error: 'Cargo inválido' }, { status: 400 })
    }
    update.cargo = body.cargo
  }
  if (body.esSuperadmin !== undefined) {
    if (id === sesion.userId && body.esSuperadmin === false) {
      return NextResponse.json({ error: 'No puedes quitarte a ti mismo el rol de superadmin' }, { status: 400 })
    }
    update.es_superadmin = !!body.esSuperadmin
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase.from('perfiles').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'editar_perfil_usuario', 'usuario', id, update)

  return NextResponse.json({ ok: true })
}

// Elimina la cuenta de un usuario (parcelero o comité). Solo superadmin.
// Su parcela (si tiene) NO se borra: solo queda sin dueño asociado (user_id -> null,
// vía ON DELETE SET NULL), para no perder el historial de lecturas/pagos/cuentas.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion || !esSuperadmin(sesion)) {
    return NextResponse.json({ error: 'Solo un superadministrador puede eliminar usuarios' }, { status: 403 })
  }

  const { id } = await params
  if (id === sesion.userId) {
    return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'eliminar_usuario', 'usuario', id, {})

  return NextResponse.json({ ok: true })
}
