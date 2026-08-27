import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await req.json()

  const update: Record<string, unknown> = {}
  if (body.numero !== undefined) update.numero = Number(body.numero)
  if (body.nombre_dueno !== undefined) update.nombre_dueno = body.nombre_dueno
  if (body.email !== undefined) update.email = body.email ? body.email.toLowerCase().trim() : null
  if (body.telefono !== undefined) update.telefono = body.telefono || null
  if (body.activa !== undefined) update.activa = body.activa
  if (body.tiene_empalme !== undefined) update.tiene_empalme = body.tiene_empalme

  const { data: parcelaPrevia } = await supabase.from('parcelas').select('user_id, email').eq('id', id).single()

  const { data, error } = await supabase
    .from('parcelas')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Si la parcela tiene una cuenta vinculada y el email cambió, hay que sincronizar
  // el email de esa cuenta (Supabase Auth) o el login y la recuperación de clave
  // dejan de funcionar con el correo nuevo.
  if (parcelaPrevia?.user_id && update.email && update.email !== parcelaPrevia.email) {
    const { error: errAuth } = await supabase.auth.admin.updateUserById(parcelaPrevia.user_id, {
      email: update.email as string,
      email_confirm: true,
    })
    if (errAuth) {
      return NextResponse.json({ error: `Parcela actualizada, pero no se pudo sincronizar el correo de acceso: ${errAuth.message}` }, { status: 400 })
    }
  }

  const sesion = await getSesion()
  await registrar(sesion, 'editar_parcela', 'parcela', id, update)

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const sesion = await getSesion()

  // Verificar si tiene historial; si lo tiene, solo desactivar
  const { count } = await supabase
    .from('cuentas_parcela')
    .select('*', { count: 'exact', head: true })
    .eq('parcela_id', id)

  if (count && count > 0) {
    const { error } = await supabase
      .from('parcelas')
      .update({ activa: false })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    await registrar(sesion, 'desactivar_parcela', 'parcela', id)
    return NextResponse.json({ desactivada: true, mensaje: 'La parcela tiene historial, se desactivó en vez de eliminar' })
  }

  const { error } = await supabase.from('parcelas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await registrar(sesion, 'eliminar_parcela', 'parcela', id)
  return NextResponse.json({ eliminada: true })
}
