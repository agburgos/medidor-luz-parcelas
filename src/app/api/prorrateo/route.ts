import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

/**
 * Motor de cobro COPOSA — cuadra exacto contra la factura:
 *
 *   cargo_fijo_total = cargo_fijo × N parcelas con cobro (conectadas)
 *   monto_a_prorratear = monto_total_factura - cargo_fijo_total
 *   tarifa_kwh = monto_a_prorratear / consumo_total_kwh   ← se calcula, no se ingresa
 *
 *   monto_consumo    = consumo_kwh × tarifa_kwh
 *   monto_cargo_fijo = cargo_fijo
 *   total parcela    = monto_consumo + monto_cargo_fijo
 *
 * La suma de todas las parcelas = monto_total_factura (con el redondeo
 * ajustado en la última parcela para que cuadre al peso).
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
    .select('monto_total_factura, cargo_fijo')
    .eq('id', periodo_id)
    .single()

  if (!periodo) return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 })
  if (!periodo.monto_total_factura || periodo.monto_total_factura <= 0) {
    return NextResponse.json({ error: 'Define el monto total de la factura en el período antes de calcular' }, { status: 400 })
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
  const cargoFijo = periodo.cargo_fijo ?? 5500

  const conectadas = (lecturas as Lectura[]).filter(l => l.estado !== 'desconectado')
  if (conectadas.length === 0) {
    return NextResponse.json({ error: 'No hay parcelas conectadas para cobrar' }, { status: 400 })
  }

  const consumoTotal = conectadas.reduce((s, l) => {
    const consumo = ['s_info', 'saldo_af'].includes(l.estado) ? 0 : Math.max(l.consumo_kwh ?? 0, 0)
    return s + consumo
  }, 0)
  if (consumoTotal <= 0) {
    return NextResponse.json({ error: 'El consumo total es 0, no se puede derivar la tarifa desde la factura' }, { status: 400 })
  }

  const cargoFijoTotal = cargoFijo * conectadas.length
  const montoAProrratear = periodo.monto_total_factura - cargoFijoTotal
  const tarifa = montoAProrratear / consumoTotal // $/kWh derivado de la factura, no manual

  const cuentas = conectadas.map(l => {
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

  // Ajuste de redondeo: la diferencia entre lo cobrado y la factura real
  // se corrige en la parcela de mayor consumo para que cuadre al peso.
  const totalCobrado = cuentas.reduce((s, c) => s + c.monto_prorrateado, 0)
  const diferencia = Math.round(periodo.monto_total_factura - totalCobrado)
  if (diferencia !== 0 && cuentas.length > 0) {
    const mayor = cuentas.reduce((a, b) => (b.monto_consumo > a.monto_consumo ? b : a))
    mayor.monto_consumo += diferencia
    mayor.monto_prorrateado += diferencia
  }

  const { error } = await supabase
    .from('cuentas_parcela')
    .upsert(cuentas, { onConflict: 'periodo_id,parcela_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Registrar la tarifa calculada en el período (para mostrarla en reportes)
  await supabase
    .from('periodos_facturacion')
    .update({ costo_unitario_kwh: Math.round(tarifa * 100) / 100 })
    .eq('id', periodo_id)

  const totalFinal = cuentas.reduce((s, c) => s + c.monto_prorrateado, 0)

  const sesion = await getSesion()
  await registrar(sesion, 'calcular_prorrateo', 'periodo_facturacion', periodo_id, {
    tarifa_calculada: Math.round(tarifa * 100) / 100, consumo_total: consumoTotal, parcelas: cuentas.length,
  })

  return NextResponse.json({
    total: cuentas.length,
    tarifa_calculada: Math.round(tarifa * 100) / 100,
    consumo_total_kwh: consumoTotal,
    total_cobrado: totalFinal,
    excedente: totalFinal - periodo.monto_total_factura,
  })
}
