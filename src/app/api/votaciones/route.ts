import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

// GET: listar votaciones (parcelero ve abiertas; comité ve todas)
export async function GET(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = createServiceClient()
  const ahora = new Date().toISOString()

  let query = supabase
    .from('votaciones')
    .select('id, titulo, descripcion, tipo_conteo, es_secreta, visibilidad_resultados, estado, fecha_inicio, fecha_cierre')
    .order('fecha_cierre', { ascending: true })

  // Parceleros ven solo votaciones abiertas
  if (sesion.rol === 'parcelero') {
    query = query.eq('estado', 'abierta').gte('fecha_cierre', ahora)
  }
  // Comité ve todas (para admin)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json(data || [])
}

// POST: crear votación (solo comité)
export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabase = createServiceClient()
  const body = await req.json()

  const { titulo, descripcion, tipo_conteo, es_secreta, visibilidad_resultados, fecha_inicio, fecha_cierre, opciones, asamblea_id } = body

  if (!titulo || !tipo_conteo || !fecha_inicio || !fecha_cierre) {
    return NextResponse.json({ error: 'Campos requeridos: titulo, tipo_conteo, fecha_inicio, fecha_cierre' }, { status: 400 })
  }

  const { data: votacion, error: errVot } = await supabase
    .from('votaciones')
    .insert({
      titulo,
      descripcion,
      tipo_conteo,
      es_secreta: es_secreta ?? true,
      visibilidad_resultados: visibilidad_resultados ?? 'solo_al_cerrar',
      fecha_inicio,
      fecha_cierre,
      asamblea_id,
    })
    .select()
    .single()

  if (errVot) return NextResponse.json({ error: errVot.message }, { status: 400 })

  // Insertar opciones si se proporcionan
  if (opciones && Array.isArray(opciones) && opciones.length > 0) {
    const opcionesData = opciones.map((o: { texto: string; foto_url?: string; orden?: number }, i: number) => ({
      votacion_id: votacion.id,
      texto: o.texto,
      foto_url: o.foto_url || null,
      orden: o.orden !== undefined ? o.orden : i,
    }))

    const { error: errOpc } = await supabase.from('opciones_votacion').insert(opcionesData)
    if (errOpc) return NextResponse.json({ error: errOpc.message }, { status: 400 })
  }

  return NextResponse.json(votacion)
}
