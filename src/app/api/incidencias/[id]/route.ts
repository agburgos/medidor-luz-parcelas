import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

const ESTADOS_VALIDOS = ['activa', 'investigando', 'resuelto', 'cancelado']

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: incidencia, error } = await supabase
    .from('incidencias')
    .select('*, parcela:parcelas(numero, nombre_dueno, telefono, email), documentos:incidencia_documentos(id, archivo_url, tipo, fecha_subida)')
    .eq('id', id)
    .single()

  if (error || !incidencia) return NextResponse.json({ error: 'Incidencia no encontrada' }, { status: 404 })

  const puedeVer = sesion.rol === 'comite' || sesion.parcelaId === incidencia.parcela_id
  if (!puedeVer) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  return NextResponse.json(incidencia)
}

// PATCH: cambiar estado (investigando/resuelto) y notas — solo comité
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const supabase = createServiceClient()

  const update: Record<string, unknown> = {}
  if (body.estado) {
    if (!ESTADOS_VALIDOS.includes(body.estado)) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
    update.estado = body.estado
    if (body.estado === 'resuelto') {
      update.fecha_resolucion = new Date().toISOString()
      update.resuelto_por = sesion.userId
    }
  }
  if (typeof body.notas_resolucion === 'string') update.notas_resolucion = body.notas_resolucion.slice(0, 2000)

  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })

  const { data, error } = await supabase
    .from('incidencias')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'actualizar_incidencia', 'incidencia', id, update)
  return NextResponse.json(data)
}
