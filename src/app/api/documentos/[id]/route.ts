import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json()
  const cambios: Record<string, unknown> = {}
  if (typeof body.nombre === 'string' && body.nombre.trim()) cambios.nombre = body.nombre.trim()
  if ('fecha' in body) cambios.fecha = body.fecha || null
  if ('asamblea_id' in body) cambios.asamblea_id = body.asamblea_id || null
  if (typeof body.solo_comite === 'boolean') cambios.solo_comite = body.solo_comite
  if (Object.keys(cambios).length === 0) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase.from('documentos').update(cambios).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'editar_documento', 'documento', id, cambios)
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const { data: doc } = await supabase.from('documentos').select('nombre').eq('id', id).single()
  const { error } = await supabase.from('documentos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'eliminar_documento', 'documento', id, { nombre: doc?.nombre })
  return NextResponse.json({ eliminado: true })
}
