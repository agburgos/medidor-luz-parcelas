import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

export async function GET() {
  const sesion = await getSesion()
  if (!sesion || !sesion.parcelaId) return NextResponse.json([])

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('cuentas_gc')
    .select('*, periodo:periodos_gc(mes,anio,fecha_vencimiento,fecha_corte)')
    .eq('parcela_id', sesion.parcelaId)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
