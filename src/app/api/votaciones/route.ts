import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { enviarCorreoEvento } from '@/lib/emailAlertas'

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

  // Marcar cuáles ya votó y qué opción(es) eligió (para parceleros y comités con parcela)
  type VotacionRow = { id: string; tipo_conteo: string; [key: string]: unknown }
  const filas = (data ?? []) as VotacionRow[]
  if (sesion.parcelaId && filas.length > 0) {
    const votacionIds = filas.map((v: VotacionRow) => v.id)
    const { data: misVotos } = await supabase
      .from('votos')
      .select('votacion_id, opcion_id, opcion_ids')
      .eq('parcela_id', sesion.parcelaId)
      .in('votacion_id', votacionIds)

    const { data: todasOpciones } = await supabase
      .from('opciones_votacion')
      .select('id, texto')
      .in('votacion_id', votacionIds)
    const opcionesTexto = new Map((todasOpciones ?? []).map((o: { id: string; texto: string }) => [o.id, o.texto]))

    type MiVoto = { votacion_id: string; opcion_id: string | null; opcion_ids: string[] | null }
    const votosPorVotacion = new Map<string, MiVoto>(
      (misVotos ?? []).map((v: MiVoto) => [v.votacion_id, v])
    )

    const conVoto = filas.map((v: VotacionRow) => {
      const miVoto = votosPorVotacion.get(v.id)
      if (!miVoto) return { ...v, yaVoto: false, miVotoOpciones: [] as string[] }
      const ids = v.tipo_conteo === 'unica'
        ? (miVoto.opcion_id ? [miVoto.opcion_id] : [])
        : (miVoto.opcion_ids ?? [])
      return { ...v, yaVoto: true, miVotoOpciones: ids.map((oid: string) => opcionesTexto.get(oid) ?? oid) }
    })

    return NextResponse.json(conVoto)
  }

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

  const fechaCierreFmt = new Date(fecha_cierre).toLocaleString('es-CL')
  await enviarCorreoEvento(
    'alerta_votacion',
    `🗳️ Nueva votación: ${titulo}`,
    `
<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
  <h2 style="color:#1d4ed8;">🗳️ Nueva votación abierta</h2>
  <p><strong>${titulo}</strong></p>
  ${descripcion ? `<p>${descripcion}</p>` : ''}
  <p>Cierra: <strong>${fechaCierreFmt}</strong></p>
  <a href="${process.env.NEXT_PUBLIC_APP_URL || ''}/parcelero/votaciones" style="display:inline-block;background:#1d4ed8;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:8px;">Ir a votar</a>
  <p style="color:#9ca3af;font-size:12px;margin-top:24px;">Comité COPOSA</p>
</div>`
  )

  return NextResponse.json(votacion)
}
