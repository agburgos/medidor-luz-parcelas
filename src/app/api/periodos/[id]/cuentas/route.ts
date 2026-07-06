import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('cuentas_parcela')
    .select('*, parcela:parcelas(numero,nombre_dueno,email), periodo:periodos_facturacion(mes,anio,monto_total_factura)')
    .eq('periodo_id', id)
    .order('parcela(numero)', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
