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

  const { data, error } = await supabase
    .from('parcelas')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

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
