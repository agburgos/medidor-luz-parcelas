import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function csvEscape(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// CSV: por parcela, deuda de mora anterior + deuda del último período con
// factura cargada (abierto o el más reciente con monto_total_factura) + acumulado.
export async function GET() {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()

  const { data: ultimoPeriodo } = await supabase
    .from('periodos_facturacion')
    .select('id, mes, anio')
    .gt('monto_total_factura', 0)
    .order('anio', { ascending: false })
    .order('mes', { ascending: false })
    .limit(1)
    .maybeSingle()

  const [{ data: parcelas }, { data: moras }, { data: cuentasPeriodo }] = await Promise.all([
    supabase.from('parcelas').select('id, numero, nombre_dueno').eq('activa', true).order('numero'),
    supabase.from('moras_anteriores').select('parcela_id, monto, monto_pagado').neq('estado', 'pagado'),
    ultimoPeriodo
      ? supabase.from('cuentas_parcela').select('parcela_id, monto_prorrateado, monto_pagado').eq('periodo_id', ultimoPeriodo.id)
      : Promise.resolve({ data: [] as { parcela_id: string; monto_prorrateado: number; monto_pagado: number }[] }),
  ])

  const deudaMoraPorParcela = new Map<string, number>()
  for (const m of moras ?? []) {
    const saldo = Math.max(Number(m.monto) - Number(m.monto_pagado), 0)
    deudaMoraPorParcela.set(m.parcela_id, (deudaMoraPorParcela.get(m.parcela_id) ?? 0) + saldo)
  }

  const deudaPeriodoPorParcela = new Map<string, number>()
  for (const c of cuentasPeriodo ?? []) {
    const saldo = Math.max(Number(c.monto_prorrateado) - Number(c.monto_pagado), 0)
    deudaPeriodoPorParcela.set(c.parcela_id, saldo)
  }

  const nombrePeriodo = ultimoPeriodo ? `${meses[ultimoPeriodo.mes - 1]} ${ultimoPeriodo.anio}` : 'Sin período con factura'

  const filas = (parcelas ?? []).map((p: { id: string; numero: number; nombre_dueno: string }) => {
    const deudaMora = deudaMoraPorParcela.get(p.id) ?? 0
    const deudaPeriodo = deudaPeriodoPorParcela.get(p.id) ?? 0
    return {
      numero: p.numero,
      nombre_dueno: p.nombre_dueno,
      deuda_mora_anterior: deudaMora,
      deuda_periodo: deudaPeriodo,
      acumulado: deudaMora + deudaPeriodo,
    }
  }).filter((f: { acumulado: number }) => f.acumulado > 0)

  const encabezado = ['Parcela', 'Dueño', 'Deuda mora anterior', `Deuda ${nombrePeriodo}`, 'Acumulado']
  type Fila = { numero: number; nombre_dueno: string; deuda_mora_anterior: number; deuda_periodo: number; acumulado: number }
  const lineas = [
    encabezado.map(csvEscape).join(','),
    ...filas.map((f: Fila) => [
      f.numero,
      csvEscape(f.nombre_dueno),
      f.deuda_mora_anterior,
      f.deuda_periodo,
      f.acumulado,
    ].join(',')),
  ]

  const csv = '﻿' + lineas.join('\n') // BOM para que Excel reconozca UTF-8

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="reporte-moras-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
