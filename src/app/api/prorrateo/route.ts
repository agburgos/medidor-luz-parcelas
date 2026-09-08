import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion, esSuperadmin } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

/**
 * Motor de cobro COPOSA — la factura se paga solo con el consumo real;
 * el cargo fijo es aparte, como fondo de reserva:
 *
 *   tarifa_kwh = monto_total_factura / consumo_total_kwh   ← se calcula, no se ingresa
 *
 *   monto_consumo    = consumo_kwh × tarifa_kwh
 *   monto_cargo_fijo = cargo_fijo                          ← aparte, a TODA parcela con empalme
 *   total parcela    = monto_consumo + monto_cargo_fijo
 *
 * La suma de monto_consumo de todas las parcelas = monto_total_factura
 * (con el redondeo ajustado en la parcela de mayor consumo para que cuadre
 * al peso). La suma de monto_cargo_fijo queda aparte como fondo de reserva
 * (factura + cargo_fijo × N parcelas con empalme).
 *
 * Estados especiales de lectura:
 *   normal        → consumo × tarifa + cargo fijo
 *   s_info        → sin lectura este mes: solo cargo fijo
 *   nuevo         → recién conectado sin lectura anterior: consumo (si hay) + cargo fijo
 *   saldo_af      → saldo a favor: solo cargo fijo
 *   desconectado  → solo cargo fijo (mantiene el empalme físico, no se le cobra consumo)
 */
export async function POST(req: NextRequest) {
  const { periodo_id } = await req.json()
  if (!periodo_id) return NextResponse.json({ error: 'periodo_id requerido' }, { status: 400 })

  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabase = createServiceClient()

  const { data: periodo } = await supabase
    .from('periodos_facturacion')
    .select('monto_total_factura, cargo_fijo, prorrateo_calculado, fecha_vencimiento')
    .eq('id', periodo_id)
    .single()

  if (!periodo) return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 })
  if (!periodo.monto_total_factura || periodo.monto_total_factura <= 0) {
    return NextResponse.json({ error: 'Define el monto total de la factura en el período antes de calcular' }, { status: 400 })
  }

  // Una vez calculado, el prorrateo queda cerrado: solo el superadmin puede recalcularlo.
  if (periodo.prorrateo_calculado && !esSuperadmin(sesion)) {
    return NextResponse.json({
      error: 'El prorrateo de este período ya fue calculado y está cerrado. Solo un superadministrador puede recalcularlo.',
    }, { status: 403 })
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

  const todas = lecturas as Lectura[]

  // Toda parcela con empalme paga cargo fijo, tenga o no consumo — incluida
  // una parcela desconectada, porque igual mantiene el empalme físico. El
  // consumo (y por tanto el costo de la factura) solo se reparte entre las
  // parcelas conectadas con lectura real.
  const consumoTotal = todas.reduce((s, l) => {
    if (l.estado === 'desconectado' || ['s_info', 'saldo_af'].includes(l.estado)) return s
    return s + Math.max(l.consumo_kwh ?? 0, 0)
  }, 0)
  if (consumoTotal <= 0) {
    return NextResponse.json({ error: 'El consumo total es 0, no se puede derivar la tarifa desde la factura' }, { status: 400 })
  }

  const tarifa = periodo.monto_total_factura / consumoTotal // $/kWh: la factura completa se paga solo con consumo

  // Si se está RECALCULANDO (ya existían cuentas para este período), hay que
  // preservar los pagos ya validados en vez de resetearlos a $0 — de lo
  // contrario un recálculo "borra" pagos reales que siguen existiendo en
  // la tabla `pagos`, solo que el resumen de la cuenta queda desincronizado.
  type CuentaExistente = { id: string; parcela_id: string }
  const { data: cuentasExistentesRaw } = await supabase
    .from('cuentas_parcela')
    .select('id, parcela_id')
    .eq('periodo_id', periodo_id)
  const cuentasExistentes = (cuentasExistentesRaw ?? []) as CuentaExistente[]

  const montosPagadosPorParcela = new Map<string, number>()
  if (cuentasExistentes.length > 0) {
    const { data: pagosValidados } = await supabase
      .from('pagos')
      .select('cuenta_id, monto')
      .in('cuenta_id', cuentasExistentes.map(c => c.id))
      .eq('estado', 'validado')

    const cuentaAParcela = new Map(cuentasExistentes.map(c => [c.id, c.parcela_id]))
    for (const p of (pagosValidados ?? []) as { cuenta_id: string; monto: number }[]) {
      const parcelaId = cuentaAParcela.get(p.cuenta_id)
      if (!parcelaId) continue
      montosPagadosPorParcela.set(parcelaId, (montosPagadosPorParcela.get(parcelaId) ?? 0) + Number(p.monto))
    }
  }

  const vencido = periodo.fecha_vencimiento ? new Date(periodo.fecha_vencimiento + 'T23:59:59') < new Date() : false

  const cuentas = todas.map(l => {
    const esDesconectada = l.estado === 'desconectado'
    // Desconectada: no se cobra nada (ni consumo ni cargo fijo) — el servicio
    // está cortado. Todo el resto con empalme activo (incluido s_info/saldo_af
    // sin consumo) sí paga el cargo fijo aparte, como fondo de reserva.
    const consumo = (esDesconectada || ['s_info', 'saldo_af'].includes(l.estado)) ? 0 : Math.max(l.consumo_kwh ?? 0, 0)
    const montoConsumo = esDesconectada ? 0 : Math.round(consumo * tarifa)
    const montoCargoFijo = esDesconectada ? 0 : cargoFijo
    const montoProrrateado = montoConsumo + montoCargoFijo
    const montoPagado = montosPagadosPorParcela.get(l.parcela_id) ?? 0
    const estado = esDesconectada
      ? 'desconectado'
      : montoPagado >= montoProrrateado && montoProrrateado > 0
      ? 'pagado'
      : montoPagado > 0 ? (vencido ? 'mora' : 'pago_parcial')
      : vencido ? 'mora' : 'pendiente'
    return {
      periodo_id,
      parcela_id: l.parcela_id,
      monto_consumo: montoConsumo,
      monto_cargo_fijo: montoCargoFijo,
      monto_prorrateado: montoProrrateado,
      monto_pagado: montoPagado,
      estado,
    }
  })

  // Ajuste de redondeo: la diferencia entre lo cobrado por consumo y la
  // factura real se corrige en la parcela de mayor consumo para que cuadre
  // al peso. El cargo fijo (fondo de reserva) no entra en este ajuste: es
  // un monto fijo aparte, siempre exacto.
  const totalConsumoCobrado = cuentas.reduce((s, c) => s + c.monto_consumo, 0)
  const diferencia = Math.round(periodo.monto_total_factura - totalConsumoCobrado)
  if (diferencia !== 0 && cuentas.length > 0) {
    const mayor = cuentas.reduce((a, b) => (b.monto_consumo > a.monto_consumo ? b : a))
    mayor.monto_consumo += diferencia
    mayor.monto_prorrateado += diferencia
  }

  const { error } = await supabase
    .from('cuentas_parcela')
    .upsert(cuentas, { onConflict: 'periodo_id,parcela_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Registrar la tarifa calculada y cerrar el período contra nuevas ediciones de lectura
  await supabase
    .from('periodos_facturacion')
    .update({ costo_unitario_kwh: Math.round(tarifa * 100) / 100, prorrateo_calculado: true })
    .eq('id', periodo_id)

  const totalConsumoFinal = cuentas.reduce((s, c) => s + c.monto_consumo, 0)
  const totalCargoFijoFinal = cuentas.reduce((s, c) => s + c.monto_cargo_fijo, 0)
  const totalFinal = totalConsumoFinal + totalCargoFijoFinal

  await registrar(sesion, periodo.prorrateo_calculado ? 'recalcular_prorrateo' : 'calcular_prorrateo', 'periodo_facturacion', periodo_id, {
    tarifa_calculada: Math.round(tarifa * 100) / 100, consumo_total: consumoTotal, parcelas: cuentas.length,
  })

  return NextResponse.json({
    total: cuentas.length,
    tarifa_calculada: Math.round(tarifa * 100) / 100,
    consumo_total_kwh: consumoTotal,
    total_cobrado: totalFinal,
    total_factura_cubierta: totalConsumoFinal,
    fondo_reserva: totalCargoFijoFinal,
  })
}
