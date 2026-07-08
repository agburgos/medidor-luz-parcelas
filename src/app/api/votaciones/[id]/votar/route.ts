import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

// POST: registrar voto de una parcela
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion || !sesion.parcelaId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id: votacion_id } = await params
  const supabase = createServiceClient()
  const body = await req.json()
  const { opcion_id, opcion_ids } = body
  const parcela_id = sesion.parcelaId

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
    .eq('parcela_id', parcela_id)
    .single()

  if (yaVoto) {
    return NextResponse.json({ error: 'Ya has votado en esta votación' }, { status: 400 })
  }

  // Registrar voto
  const votoData = {
    votacion_id,
    parcela_id,
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

  if (sesion.suplantando) {
    await registrar(sesion, 'votar_suplantando', 'votacion', votacion_id, {
      parcela_suplantada: sesion.suplantando.numero,
    })
  }

  return NextResponse.json({ mensaje: 'Voto registrado exitosamente', voto })
}
