import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

interface Opcion {
  id: string
  texto: string
  foto_url: string | null
  orden: number
}

interface Voto {
  opcion_id: string | null
  opcion_ids: string[] | null
}

// GET: obtener resultados de una votación
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: votacion_id } = await params
  const supabase = createServiceClient()

  // Obtener votación
  const { data: votacion, error: errVot } = await supabase
    .from('votaciones')
    .select('*')
    .eq('id', votacion_id)
    .single()

  if (errVot || !votacion) {
    return NextResponse.json({ error: 'Votación no encontrada' }, { status: 404 })
  }

  // Verificar visibilidad de resultados
  const ahora = new Date().toISOString()
  const estaCerrada = votacion.estado === 'cerrada' || votacion.fecha_cierre <= ahora

  // Lógica de visibilidad
  if (votacion.visibilidad_resultados === 'solo_al_cerrar' && !estaCerrada) {
    return NextResponse.json({ error: 'Resultados no disponibles hasta que cierre la votación' }, { status: 403 })
  }

  if (votacion.visibilidad_resultados === 'en_vivo_comite' && sesion.rol !== 'comite') {
    return NextResponse.json({ error: 'Resultados solo disponibles para el comité' }, { status: 403 })
  }

  // Obtener opciones con recuento de votos
  const { data: opciones, error: errOpc } = await supabase
    .from('opciones_votacion')
    .select('id, texto, foto_url, orden')
    .eq('votacion_id', votacion_id)
    .order('orden', { ascending: true })

  if (errOpc) {
    return NextResponse.json({ error: errOpc.message }, { status: 400 })
  }

  // Contar votos por opción
  const { data: votos, error: errVotos } = await supabase
    .from('votos')
    .select('opcion_id, opcion_ids')
    .eq('votacion_id', votacion_id)

  if (errVotos) {
    return NextResponse.json({ error: errVotos.message }, { status: 400 })
  }

  // Procesar resultados
  const conteoOpciones: Record<string, number> = {}
  let totalVotos = 0

  for (const voto of (votos as Voto[]) || []) {
    if (votacion.tipo_conteo === 'unica' && voto.opcion_id) {
      conteoOpciones[voto.opcion_id] = (conteoOpciones[voto.opcion_id] || 0) + 1
      totalVotos++
    } else if (votacion.tipo_conteo === 'multiple' && voto.opcion_ids && Array.isArray(voto.opcion_ids)) {
      for (const oid of voto.opcion_ids) {
        conteoOpciones[oid] = (conteoOpciones[oid] || 0) + 1
      }
      totalVotos++
    }
  }

  // Construir respuesta
  const opcionesConVotos = ((opciones as Opcion[]) || []).map((op: Opcion) => {
    const votosCount = conteoOpciones[op.id] || 0
    const porcentaje = totalVotos > 0 ? Math.round((votosCount / totalVotos) * 100) : 0
    return {
      id: op.id,
      texto: op.texto,
      foto_url: op.foto_url,
      votos: votosCount,
      porcentaje,
    }
  })

  // Obtener el parcela_id del usuario para saber si ya votó
  let yaVoto = false
  if (sesion.parcelaId) {
    const { data: miVoto } = await supabase
      .from('votos')
      .select('id')
      .eq('votacion_id', votacion_id)
      .eq('parcela_id', sesion.parcelaId)
      .single()

    yaVoto = !!miVoto
  }

  // Contar participación
  const { count: totalParticipacion } = await supabase
    .from('votos')
    .select('id', { count: 'exact' })
    .eq('votacion_id', votacion_id)

  const participacion = totalParticipacion > 0 ? Math.round((totalParticipacion / 80) * 100) : 0

  return NextResponse.json({
    votacion,
    opciones: opcionesConVotos,
    participacion,
    totalVotos: totalParticipacion || 0,
    yaVoto,
  })
}
