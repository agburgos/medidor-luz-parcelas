import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

export async function GET() {
  const sesion = await getSesion()
  const supabase = createServiceClient()
  let query = supabase.from('asambleas').select('*').order('fecha', { ascending: false })
  if (sesion?.rol !== 'comite') query = query.neq('tipo', 'directiva')
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const body = await req.json()
  if (!body.titulo || !body.fecha) return NextResponse.json({ error: 'Título y fecha son requeridos' }, { status: 400 })

  const { data: comunidad } = await supabase.from('comunidades').select('id').eq('activa', true).limit(1).single()

  const { data, error } = await supabase
    .from('asambleas')
    .insert({
      comunidad_id: comunidad?.id ?? null,
      titulo: body.titulo,
      tipo: body.tipo || 'ordinaria',
      fecha: body.fecha,
      hora_inicio: body.hora_inicio || null,
      hora_termino: body.hora_termino || null,
      lugar: body.lugar || null,
      created_by: sesion.userId,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'crear_asamblea', 'asamblea', data.id, { titulo: body.titulo, fecha: body.fecha })
  return NextResponse.json(data)
}
