import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('pagos')
    .select('*, cuenta:cuentas_parcela(id, periodo_id, monto_prorrateado, monto_pagado, parcela:parcelas(numero,nombre_dueno), periodo:periodos_facturacion(mes,anio,monto_total_factura))')
    .eq('estado', 'por_validar')
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  type Pago = NonNullable<typeof data>[number] & { cuenta: { periodo_id: string } | null }
  const periodoIds = [...new Set((data as Pago[] ?? []).map(p => p.cuenta?.periodo_id).filter(Boolean))]
  const recaudadoPorPeriodo = new Map<string, number>()
  await Promise.all(periodoIds.map(async (periodoId) => {
    const { data: cuentas } = await supabase.from('cuentas_parcela').select('monto_pagado').eq('periodo_id', periodoId as string)
    recaudadoPorPeriodo.set(periodoId as string, (cuentas ?? []).reduce((s: number, c: { monto_pagado: number }) => s + Number(c.monto_pagado), 0))
  }))

  const enriquecido = (data as Pago[] ?? []).map(p => ({
    ...p,
    recaudado_periodo: p.cuenta?.periodo_id ? recaudadoPorPeriodo.get(p.cuenta.periodo_id) ?? 0 : null,
  }))

  return NextResponse.json(enriquecido)
}
