import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

const MAX_PROPUESTAS_POR_PARCELA = 3
const normalizar = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

// GET: obtener opciones de una votación
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: votacion_id } = await params
  const supabase = createServiceClient()

  const { data: votacion, error: errVot } = await supabase
    .from('votaciones')
    .select('id, estado')
    .eq('id', votacion_id)
    .single()

  if (errVot || !votacion) {
    return NextResponse.json({ error: 'Votación no encontrada' }, { status: 404 })
  }

  const { data: opciones, error: errOpc } = await supabase
    .from('opciones_votacion')
    .select('id, texto, foto_url, orden, propuesta_por_parcela_id')
    .eq('votacion_id', votacion_id)
    .order('orden', { ascending: true })

  if (errOpc) {
    return NextResponse.json({ error: errOpc.message }, { status: 400 })
  }

  // El parcelero solo ve si una opción es propuesta de un vecino (anónimo) y
  // si es suya; quién la propuso solo lo ve el comité en los resultados.
  return NextResponse.json((opciones ?? []).map((o: { id: string; texto: string; foto_url: string | null; orden: number; propuesta_por_parcela_id: string | null }) => ({
    id: o.id, texto: o.texto, foto_url: o.foto_url, orden: o.orden,
    propuesta: !!o.propuesta_por_parcela_id,
    mia: !!o.propuesta_por_parcela_id && o.propuesta_por_parcela_id === sesion.parcelaId,
  })))
}

// POST: un vecino propone una opción nueva (solo si la votación lo permite y sigue abierta)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion || !sesion.parcelaId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id: votacion_id } = await params
  const supabase = createServiceClient()
  const { texto } = await req.json()
  const limpio = String(texto ?? '').replace(/\s+/g, ' ').trim()
  if (limpio.length < 2) return NextResponse.json({ error: 'Escribe tu opción (mínimo 2 letras)' }, { status: 400 })
  if (limpio.length > 120) return NextResponse.json({ error: 'La opción es muy larga (máximo 120 caracteres)' }, { status: 400 })

  const { data: votacion } = await supabase
    .from('votaciones')
    .select('id, estado, fecha_cierre, permite_opciones_vecinos')
    .eq('id', votacion_id)
    .single()
  if (!votacion) return NextResponse.json({ error: 'Votación no encontrada' }, { status: 404 })
  if (votacion.estado !== 'abierta' || votacion.fecha_cierre < new Date().toISOString()) {
    return NextResponse.json({ error: 'Votación cerrada' }, { status: 400 })
  }
  if (!votacion.permite_opciones_vecinos) {
    return NextResponse.json({ error: 'Esta votación no permite proponer opciones' }, { status: 403 })
  }

  const { data: existentes } = await supabase
    .from('opciones_votacion')
    .select('id, texto, orden, propuesta_por_parcela_id')
    .eq('votacion_id', votacion_id)
  const lista = (existentes ?? []) as { id: string; texto: string; orden: number; propuesta_por_parcela_id: string | null }[]

  // Si ya existe una igual, se reutiliza en vez de duplicarla (los votos no se dividen).
  const repetida = lista.find(o => normalizar(o.texto) === normalizar(limpio))
  if (repetida) return NextResponse.json({ id: repetida.id, texto: repetida.texto, existente: true })

  if (lista.filter(o => o.propuesta_por_parcela_id === sesion.parcelaId).length >= MAX_PROPUESTAS_POR_PARCELA) {
    return NextResponse.json({ error: `Puedes proponer hasta ${MAX_PROPUESTAS_POR_PARCELA} opciones por votación` }, { status: 400 })
  }

  const orden = Math.max(-1, ...lista.map(o => o.orden)) + 1
  const { data, error } = await supabase
    .from('opciones_votacion')
    .insert({ votacion_id, texto: limpio, orden, propuesta_por_parcela_id: sesion.parcelaId })
    .select('id, texto, foto_url, orden')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (sesion.suplantando) {
    await registrar(sesion, 'proponer_opcion_suplantando', 'votacion', votacion_id, { texto: limpio, parcela_suplantada: sesion.suplantando.numero })
  }
  return NextResponse.json({ ...data, propuesta: true, mia: true })
}

// DELETE: el comité retira una opción propuesta (moderación). Los votos que la
// usaban se limpian: quien votó solo por ella debe volver a votar.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id: votacion_id } = await params
  const opcionId = req.nextUrl.searchParams.get('opcion_id')
  if (!opcionId) return NextResponse.json({ error: 'opcion_id requerido' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: opcion } = await supabase
    .from('opciones_votacion')
    .select('id, texto, propuesta_por_parcela_id')
    .eq('id', opcionId)
    .eq('votacion_id', votacion_id)
    .maybeSingle()
  if (!opcion) return NextResponse.json({ error: 'Opción no encontrada' }, { status: 404 })
  if (!opcion.propuesta_por_parcela_id) {
    return NextResponse.json({ error: 'Solo se pueden retirar opciones propuestas por vecinos' }, { status: 400 })
  }

  const { data: votos } = await supabase.from('votos').select('id, opcion_id, opcion_ids').eq('votacion_id', votacion_id)
  let votosAfectados = 0
  for (const v of (votos ?? []) as { id: string; opcion_id: string | null; opcion_ids: string[] | null }[]) {
    if (v.opcion_id === opcionId) {
      await supabase.from('votos').delete().eq('id', v.id)
      votosAfectados++
    } else if (v.opcion_ids?.includes(opcionId)) {
      const resto = v.opcion_ids.filter(id => id !== opcionId)
      if (resto.length === 0) await supabase.from('votos').delete().eq('id', v.id)
      else await supabase.from('votos').update({ opcion_ids: resto }).eq('id', v.id)
      votosAfectados++
    }
  }

  const { error } = await supabase.from('opciones_votacion').delete().eq('id', opcionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'retirar_opcion_propuesta', 'votacion', votacion_id, { texto: opcion.texto, votos_afectados: votosAfectados })
  return NextResponse.json({ ok: true, votos_afectados: votosAfectados })
}
