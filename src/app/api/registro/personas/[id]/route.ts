import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion, puedeEditarParcela } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

async function validar(id: string) {
  const supabase = createServiceClient()
  const { data } = await supabase.from('personas').select('id, parcela_id, nombre').eq('id', id).single()
  return { supabase, persona: data }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { supabase, persona } = await validar(id)
  if (!persona || !puedeEditarParcela(sesion, persona.parcela_id)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await req.json()
  const update: Record<string, unknown> = {}
  for (const campo of ['nombre', 'relacion', 'rut', 'telefono', 'email']) {
    if (body[campo] !== undefined) update[campo] = body[campo] || null
  }

  const { data, error } = await supabase.from('personas').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'editar_persona', 'persona', id, { nombre: persona.nombre, cambios: update })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { supabase, persona } = await validar(id)
  if (!persona || !puedeEditarParcela(sesion, persona.parcela_id)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { error } = await supabase.from('personas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'eliminar_persona', 'persona', id, { nombre: persona.nombre })
  return NextResponse.json({ eliminada: true })
}
