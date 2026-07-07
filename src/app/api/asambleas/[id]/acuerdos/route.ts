import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const body = await req.json()
  if (!body.descripcion) return NextResponse.json({ error: 'Descripción requerida' }, { status: 400 })

  const { data, error } = await supabase
    .from('asamblea_acuerdos')
    .insert({
      asamblea_id: id,
      descripcion: body.descripcion,
      responsable: body.responsable || null,
      fecha_limite: body.fecha_limite || null,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'crear_acuerdo', 'asamblea', id, { descripcion: body.descripcion })

  return NextResponse.json(data)
}
