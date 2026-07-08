import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

// POST: registrar voto de un parcelero
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'parcelero') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabase = createServiceClient()
  const votacion_id = params.id
  const body = await req.json()
  const { opcion_id, opcion_ids } = body // opcion_id para única, opcion_ids array para múltiple

  // Obtener parcela del usuario
  const { data: parcela, error: errParcela } = await supabase
    .from('parcelas')
    .select('id')
    .eq('user_id', sesion.user_id)
    .single()

  if (errParcela || !parcela) {
    return NextResponse.json({ error: 'Usuario sin parcela asignada' }, { status: 400 })
  }

  // Verificar que la votación existe y está abierta
  const ahora = new Date().toISOString()
  const { data: votacion, error: errVot } = await supabase
    .from('votaciones')
    .select('id, estado, fecha_cierre, tipo_conteo')
    .eq('id', votacion_id)
    .single()

  if (errVot || !votacion) {
    return NextResponse.json({ error: 'Votación no encontrada' }, { status: 404 })
  }

  if (votacion.estado !== 'abierta' || votacion.fecha_cierre < ahora) {
    return NextResponse.json({ error: 'Votación cerrada' }, { status: 400 })
  }

  // Verificar que no haya votado ya
  const { data: yaVoto } = await supabase
    .from('votos')
    .select('id')
    .eq('votacion_id', votacion_id)
    .eq('parcela_id', parcela.id)
    .single()

  if (yaVoto) {
    return NextResponse.json({ error: 'Ya has votado en esta votación' }, { status: 400 })
  }

  // Registrar voto
  const votoData = {
    votacion_id,
    parcela_id: parcela.id,
    opcion_id: votacion.tipo_conteo === 'unica' ? opcion_id : null,
    opcion_ids: votacion.tipo_conteo === 'multiple' ? opcion_ids : null,
    votado_en: ahora,
  }

  const { data: voto, error: errInsert } = await supabase
    .from('votos')
    .insert(votoData)
    .select()
    .single()

  if (errInsert) {
    return NextResponse.json({ error: errInsert.message }, { status: 400 })
  }

  return NextResponse.json({ mensaje: 'Voto registrado exitosamente', voto })
}
