import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion, esSuperadmin } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

function puedeAmbito(sesion: NonNullable<Awaited<ReturnType<typeof getSesion>>>, ambito: string) {
  if (ambito === 'tecnico') return esSuperadmin(sesion)
  return sesion.rol === 'comite'
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const { data: item } = await supabase.from('boveda_items').select('ambito').eq('id', id).maybeSingle()
  if (!item) return NextResponse.json({ error: 'Ítem no encontrado' }, { status: 404 })
  if (!puedeAmbito(sesion, item.ambito)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { categoria, iv, datos_cifrados } = body
  if (!iv || !datos_cifrados) return NextResponse.json({ error: 'Faltan datos cifrados' }, { status: 400 })

  const { data, error } = await supabase
    .from('boveda_items')
    .update({ categoria: categoria || 'otro', iv, datos_cifrados, actualizado_por: sesion.userId, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, categoria, iv, datos_cifrados, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'editar_item_boveda', 'boveda_item', id)
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const { data: item } = await supabase.from('boveda_items').select('ambito').eq('id', id).maybeSingle()
  if (!item) return NextResponse.json({ error: 'Ítem no encontrado' }, { status: 404 })
  if (!puedeAmbito(sesion, item.ambito)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { error } = await supabase.from('boveda_items').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'eliminar_item_boveda', 'boveda_item', id)
  return NextResponse.json({ ok: true })
}
