import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { cargarCuentasConSaldo } from '@/lib/caja'

export async function GET(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const { data: movimientos, error } = await supabase
    .from('caja_movimientos')
    .select('*')
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Obtener saldo inicial (del primer registro de caja_saldos)
  const { data: saldoInicial } = await supabase
    .from('caja_saldos')
    .select('saldo_final')
    .order('fecha', { ascending: true })
    .limit(1)
    .single()

  const movs = movimientos || []
  const saldoIni = saldoInicial?.saldo_final ?? 0

  // 1. Registro cronológico detallado
  let saldoActual = saldoIni
  const registro = movs.map((m: { tipo: string; monto: number; fecha: string; concepto: string; id: string; cuenta_id: string; transferencia_id: string | null }) => {
    saldoActual += m.tipo === 'ingreso' ? Number(m.monto) : -Number(m.monto)
    return {
      ...m,
      saldo_acumulado: saldoActual,
    }
  })

  // 2. Resumen mensual por concepto
  const resumenPorMes = new Map<string, { ingresos: Map<string, number>; egresos: Map<string, number> }>()
  // Las transferencias internas no son ingreso ni gasto: se excluyen de resumen y totales.
  const reales = movs.filter((m: { transferencia_id?: string | null }) => !m.transferencia_id)
  for (const m of reales) {
    const mes = m.fecha.slice(0, 7) // YYYY-MM
    if (!resumenPorMes.has(mes)) {
      resumenPorMes.set(mes, { ingresos: new Map(), egresos: new Map() })
    }
    const conceptoMap = m.tipo === 'ingreso'
      ? resumenPorMes.get(mes)!.ingresos
      : resumenPorMes.get(mes)!.egresos
    conceptoMap.set(m.concepto, (conceptoMap.get(m.concepto) ?? 0) + Number(m.monto))
  }

  const resumenMensual = Array.from(resumenPorMes.entries()).map(([mes, { ingresos, egresos }]) => ({
    mes,
    ingresos: Array.from(ingresos.entries()).map(([concepto, monto]: [string, number]) => ({ concepto, monto })),
    totalIngresos: Array.from(ingresos.values()).reduce((s: number, m: number) => s + m, 0),
    egresos: Array.from(egresos.entries()).map(([concepto, monto]: [string, number]) => ({ concepto, monto })),
    totalEgresos: Array.from(egresos.values()).reduce((s: number, m: number) => s + m, 0),
  }))

  // 3. Estado de Resultados (Balance)
  const totalIngresos = reales.filter((m: { tipo: string }) => m.tipo === 'ingreso').reduce((s: number, m: { monto: number }) => s + Number(m.monto), 0)
  const totalEgresos = reales.filter((m: { tipo: string }) => m.tipo === 'egreso').reduce((s: number, m: { monto: number }) => s + Number(m.monto), 0)
  const saldoFinal = saldoIni + totalIngresos - totalEgresos

  const { cuentas, total: totalCuentas } = await cargarCuentasConSaldo()

  return NextResponse.json({
    cuentas,
    totalCuentas,
    estadoResultados: {
      saldoInicial: saldoIni,
      totalIngresos,
      totalEgresos,
      resultado: totalIngresos - totalEgresos,
      saldoFinal,
    },
    resumenMensual,
    registroCronologico: registro,
  })
}
