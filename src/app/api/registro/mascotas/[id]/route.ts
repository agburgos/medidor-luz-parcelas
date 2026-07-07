import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion, puedeEditarParcela } from '@/lib/auth'

async function validar(id: string) {
  const supabase = createServiceClient()
  const { data } = await supabase.from('mascotas').select('id, parcela_id').eq('id', id).single()
  return { supabase, mascota: data }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { supabase, mascota } = await validar(id)
  if (!mascota || !puedeEditarParcela(sesion, mascota.parcela_id)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await req.json()
  const update: Record<string, unknown> = {}
  for (const campo of ['nombre', 'especie', 'raza', 'color', 'chip']) {
    if (body[campo] !== undefined) update[campo] = body[campo] || null
  }

  const { data, error } = await supabase.from('mascotas').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { supabase, mascota } = await validar(id)
  if (!mascota || !puedeEditarParcela(sesion, mascota.parcela_id)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { error } = await supabase.from('mascotas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ eliminada: true })
}
