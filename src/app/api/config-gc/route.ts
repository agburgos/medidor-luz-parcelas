import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

export async function GET() {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('config_gastos_comunes')
    .select('*, comunidad:comunidades(nombre)')
    .limit(1)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json()
  const valor_mensual = Number(body.valor_mensual)
  if (!valor_mensual || valor_mensual <= 0) return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('config_gastos_comunes')
    .update({ valor_mensual, updated_at: new Date().toISOString() })
    .eq('comunidad_id', body.comunidad_id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'config_gc', 'config_gastos_comunes', body.comunidad_id, { valor_mensual })
  return NextResponse.json(data)
}
