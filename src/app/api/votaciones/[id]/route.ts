import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

// GET: obtener una votación
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: votacion_id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('votaciones')
    .select('*')
    .eq('id', votacion_id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  return NextResponse.json(data)
}

// PUT: editar votación (solo comité, solo si está abierta)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id: votacion_id } = await params
  const supabase = createServiceClient()
  const body = await req.json()

  // Verificar que existe y está abierta
  const { data: votacion, error: errGet } = await supabase
    .from('votaciones')
    .select('id, estado, fecha_cierre')
    .eq('id', votacion_id)
    .single()

  if (errGet || !votacion) {
    return NextResponse.json({ error: 'Votación no encontrada' }, { status: 404 })
  }

  const ahora = new Date().toISOString()
  if (votacion.estado !== 'abierta' || votacion.fecha_cierre < ahora) {
    return NextResponse.json({ error: 'No se puede editar votación cerrada o con votos' }, { status: 400 })
  }

  // Actualizar
  const { titulo, descripcion, visibilidad_resultados, fecha_cierre } = body
  const { data, error } = await supabase
    .from('votaciones')
    .update({
      titulo: titulo ?? votacion.titulo,
      descripcion: descripcion ?? null,
      visibilidad_resultados: visibilidad_resultados ?? 'solo_al_cerrar',
      fecha_cierre: fecha_cierre ?? votacion.fecha_cierre,
    })
    .eq('id', votacion_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// DELETE: eliminar votación (solo comité, solo si no tiene votos)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id: votacion_id } = await params
  const supabase = createServiceClient()

  // Verificar que no tiene votos
  const { count: totalVotos } = await supabase
    .from('votos')
    .select('id', { count: 'exact' })
    .eq('votacion_id', votacion_id)

  if (totalVotos && totalVotos > 0) {
    return NextResponse.json({ error: 'No se puede eliminar votación con votos registrados' }, { status: 400 })
  }

  // Eliminar (cascade también elimina opciones)
  const { error } = await supabase
    .from('votaciones')
    .delete()
    .eq('id', votacion_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ mensaje: 'Votación eliminada' })
}
