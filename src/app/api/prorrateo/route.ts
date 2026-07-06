import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * Motor de cobro COPOSA:
 *   monto_consumo   = consumo_kwh × costo_unitario_kwh
 *   monto_cargo_fijo = cargo_fijo (para toda parcela conectada)
 *   total           = monto_consumo + monto_cargo_fijo
 *
 * Estados especiales de lectura:
 *   normal        → consumo × tarifa + cargo fijo
 *   s_info        → sin lectura este mes: solo cargo fijo
 *   nuevo         → recién conectado sin lectura anterior: consumo (si hay) + cargo fijo
 *   saldo_af      → saldo a favor: solo cargo fijo
 *   desconectado  → no se cobra nada
 */
export async function POST(req: NextRequest) {
  const { periodo_id } = await req.json()
  if (!periodo_id) return NextResponse.json({ error: 'periodo_id requerido' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: periodo } = await supabase
    .from('periodos_facturacion')
    .select('monto_total_factura, costo_unitario_kwh, cargo_fijo')
    .eq('id', periodo_id)
    .single()

  if (!periodo) return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 })
  if (!periodo.costo_unitario_kwh || periodo.costo_unitario_kwh <= 0) {
    return NextResponse.json({ error: 'Define el costo unitario del kWh en el período antes de calcular' }, { status: 400 })
  }

  const { data: lecturas } = await supabase
    .from('lecturas')
    .select('parcela_id, consumo_kwh, estado')
    .eq('periodo_id', periodo_id)
    .eq('confirmado', true)

  if (!lecturas || lecturas.length === 0) {
    return NextResponse.json({ error: 'No hay lecturas confirmadas para este período' }, { status: 400 })
  }

  type Lectura = { parcela_id: string; consumo_kwh: number; estado: string }
  const tarifa = periodo.costo_unitario_kwh
  const cargoFijo = periodo.cargo_fijo ?? 5500

  const cuentas = (lecturas as Lectura[])
    .filter(l => l.estado !== 'desconectado')
    .map(l => {
      const consumo = ['s_info', 'saldo_af'].includes(l.estado) ? 0 : Math.max(l.consumo_kwh ?? 0, 0)
      const montoConsumo = Math.round(consumo * tarifa)
      return {
        periodo_id,
        parcela_id: l.parcela_id,
        monto_consumo: montoConsumo,
        monto_cargo_fijo: cargoFijo,
        monto_prorrateado: montoConsumo + cargoFijo,
        monto_pagado: 0,
        estado: 'pendiente',
      }
    })

  const { error } = await supabase
    .from('cuentas_parcela')
    .upsert(cuentas, { onConflict: 'periodo_id,parcela_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const totalCobrado = cuentas.reduce((s, c) => s + c.monto_prorrateado, 0)
  return NextResponse.json({
    total: cuentas.length,
    total_cobrado: totalCobrado,
    excedente: totalCobrado - (periodo.monto_total_factura ?? 0),
  })
}
