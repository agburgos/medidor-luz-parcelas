import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const [{ data: asamblea }, { data: asistentes }, { data: acuerdos }, { data: documentos }] = await Promise.all([
    supabase.from('asambleas').select('*').eq('id', id).single(),
    supabase.from('asamblea_asistentes').select('*, parcela:parcelas(numero)').eq('asamblea_id', id).order('created_at'),
    supabase.from('asamblea_acuerdos').select('*').eq('asamblea_id', id).order('created_at'),
    supabase.from('documentos').select('*').eq('asamblea_id', id).order('created_at'),
  ])
  if (!asamblea) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  return NextResponse.json({ asamblea, asistentes: asistentes ?? [], acuerdos: acuerdos ?? [], documentos: documentos ?? [] })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const body = await req.json()
  const update: Record<string, unknown> = {}
  for (const campo of ['titulo', 'tipo', 'fecha', 'hora_inicio', 'hora_termino', 'lugar', 'estado', 'resumen', 'acta_url']) {
    if (body[campo] !== undefined) update[campo] = body[campo]
  }

  const { data, error } = await supabase.from('asambleas').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (body.estado === 'realizada') {
    await registrar(sesion, 'cerrar_asamblea', 'asamblea', id, { titulo: data.titulo })
  }
  return NextResponse.json(data)
}
