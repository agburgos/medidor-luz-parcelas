import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

// Marcar asistencia real (vino / no vino) de un citado.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ asistenteId: string }> }) {
  const { asistenteId } = await params
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const body = await req.json()
  const { data, error } = await supabase
    .from('asamblea_asistentes')
    .update({ presente: !!body.presente })
    .eq('id', asistenteId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'marcar_asistencia', 'asamblea_asistente', asistenteId, { nombre: data.nombre, presente: body.presente })

  return NextResponse.json(data)
}

// Eliminar un asistente citado por error.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ asistenteId: string }> }) {
  const { asistenteId } = await params
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const { data: asistente } = await supabase.from('asamblea_asistentes').select('nombre').eq('id', asistenteId).single()
  const { error } = await supabase.from('asamblea_asistentes').delete().eq('id', asistenteId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'quitar_asistente', 'asamblea_asistente', asistenteId, { nombre: asistente?.nombre })

  return NextResponse.json({ eliminado: true })
}
