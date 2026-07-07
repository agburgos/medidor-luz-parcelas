import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const parcelaId = req.nextUrl.searchParams.get('parcela_id')

  let query = supabase
    .from('moras_anteriores')
    .select('*, parcela:parcelas(numero,nombre_dueno)')
    .order('created_at', { ascending: false })
  if (parcelaId) query = query.eq('parcela_id', parcelaId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const body = await req.json()

  const { parcela_id, descripcion, monto, fecha_origen, tipo } = body
  if (!parcela_id || !descripcion || !monto || Number(monto) <= 0) {
    return NextResponse.json({ error: 'Parcela, descripción y monto son requeridos' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('moras_anteriores')
    .insert({
      parcela_id,
      descripcion,
      monto: Number(monto),
      fecha_origen: fecha_origen || null,
      tipo: ['luz', 'gc', 'otro'].includes(tipo) ? tipo : 'luz',
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const sesion = await getSesion()
  await registrar(sesion, 'crear_mora', 'mora', data.id, { parcela_id, descripcion, monto, tipo: data.tipo })

  return NextResponse.json(data)
}
