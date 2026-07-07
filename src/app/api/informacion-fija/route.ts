import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('informacion_fija')
    .select('*')
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const body = await req.json()
  if (!body.titulo || !body.contenido) return NextResponse.json({ error: 'Título y contenido son requeridos' }, { status: 400 })

  const { data: comunidad } = await supabase.from('comunidades').select('id').eq('activa', true).limit(1).single()
  const { count } = await supabase.from('informacion_fija').select('*', { count: 'exact', head: true })

  const { data, error } = await supabase
    .from('informacion_fija')
    .insert({
      comunidad_id: comunidad?.id ?? null,
      titulo: body.titulo,
      contenido: body.contenido,
      orden: count ?? 0,
      created_by: sesion.userId,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'crear_info_fija', 'informacion_fija', data.id, { titulo: body.titulo })
  return NextResponse.json(data)
}
