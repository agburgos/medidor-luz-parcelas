import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { periodo_id } = await req.json()
  if (!periodo_id) return NextResponse.json({ error: 'periodo_id requerido' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: periodo } = await supabase
    .from('periodos_facturacion')
    .select('monto_total_factura')
    .eq('id', periodo_id)
    .single()

  if (!periodo) return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 })

  const { data: lecturas } = await supabase
    .from('lecturas')
    .select('parcela_id, consumo_kwh')
    .eq('periodo_id', periodo_id)
    .eq('confirmado', true)

  if (!lecturas || lecturas.length === 0) {
    return NextResponse.json({ error: 'No hay lecturas confirmadas para este período' }, { status: 400 })
  }

  type Lectura = { parcela_id: string; consumo_kwh: number }
  const consumoTotal = (lecturas as Lectura[]).reduce((sum: number, l: Lectura) => sum + (l.consumo_kwh ?? 0), 0)
  if (consumoTotal === 0) {
    return NextResponse.json({ error: 'Consumo total es 0, no se puede calcular prorrateo' }, { status: 400 })
  }

  const montoTotal = periodo.monto_total_factura

  const cuentas = (lecturas as Lectura[]).map(l => ({
    periodo_id,
    parcela_id: l.parcela_id,
    monto_prorrateado: Math.round((montoTotal * (l.consumo_kwh / consumoTotal)) * 100) / 100,
    monto_pagado: 0,
    estado: 'pendiente',
  }))

  const { error } = await supabase
    .from('cuentas_parcela')
    .upsert(cuentas, { onConflict: 'periodo_id,parcela_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ total: cuentas.length, consumo_total_kwh: consumoTotal })
}
