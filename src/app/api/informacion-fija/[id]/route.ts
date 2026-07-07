import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const body = await req.json()
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.titulo !== undefined) update.titulo = body.titulo
  if (body.contenido !== undefined) update.contenido = body.contenido
  if (body.orden !== undefined) update.orden = body.orden

  const { data, error } = await supabase.from('informacion_fija').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'editar_info_fija', 'informacion_fija', id, { titulo: body.titulo })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const { data: info } = await supabase.from('informacion_fija').select('titulo').eq('id', id).single()
  const { error } = await supabase.from('informacion_fija').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'eliminar_info_fija', 'informacion_fija', id, { titulo: info?.titulo })
  return NextResponse.json({ eliminado: true })
}
