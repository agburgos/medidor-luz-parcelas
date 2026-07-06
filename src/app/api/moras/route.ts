import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('moras_anteriores')
    .select('*, parcela:parcelas(numero,nombre_dueno)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const body = await req.json()

  const { parcela_id, descripcion, monto, fecha_origen } = body
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
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
