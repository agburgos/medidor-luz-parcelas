import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

// Estado de cuenta consolidado de una parcela: Luz + Gastos Comunes + Moras
// anteriores, con todos los cargos y pagos en una sola línea de tiempo, para
// transparencia total frente al parcelero. Comité (o el propio parcelero,
// para su parcela) puede consultarlo.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  const { id } = await params
  if (!sesion || (sesion.rol !== 'comite' && sesion.parcelaId !== id)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabase = createServiceClient()

  const [{ data: parcela }, { data: cuentasLuz }, { data: cuentasGC }, { data: moras }] = await Promise.all([
    supabase.from('parcelas').select('id, numero, nombre_dueno, email, telefono').eq('id', id).single(),
    supabase.from('cuentas_parcela').select('id, monto_prorrateado, monto_pagado, estado, periodo:periodos_facturacion(mes,anio)').eq('parcela_id', id),
    supabase.from('cuentas_gc').select('id, monto, monto_pagado, estado, periodo:periodos_gc(mes,anio)').eq('parcela_id', id),
    supabase.from('moras_anteriores').select('id, descripcion, monto, monto_pagado, estado, tipo, fecha_origen').eq('parcela_id', id),
  ])

  if (!parcela) return NextResponse.json({ error: 'Parcela no encontrada' }, { status: 404 })

  const idsCuentasLuz = (cuentasLuz ?? []).map((c: { id: string }) => c.id)
  const idsCuentasGC = (cuentasGC ?? []).map((c: { id: string }) => c.id)
  const [{ data: pagosLuz }, { data: pagosGC }] = await Promise.all([
    supabase.from('pagos').select('id, monto, fecha, metodo, estado, cuenta_id').in('cuenta_id', idsCuentasLuz.length ? idsCuentasLuz : ['00000000-0000-0000-0000-000000000000']),
    supabase.from('pagos_gc').select('id, monto, fecha, metodo, estado, cuenta_gc_id').in('cuenta_gc_id', idsCuentasGC.length ? idsCuentasGC : ['00000000-0000-0000-0000-000000000000']),
  ])

  type Movimiento = { fecha: string; tipo: 'cargo' | 'pago'; concepto: string; monto: number; categoria: 'luz' | 'gc' | 'mora' }
  const movimientos: Movimiento[] = []

  type CLuz = { id: string; monto_prorrateado: number; periodo: { mes: number; anio: number } | null }
  for (const c of (cuentasLuz ?? []) as CLuz[]) {
    if (!c.periodo) continue
    movimientos.push({
      fecha: `${c.periodo.anio}-${String(c.periodo.mes).padStart(2, '0')}-01`,
      tipo: 'cargo', categoria: 'luz',
      concepto: `Cargo Luz — ${meses[c.periodo.mes - 1]} ${c.periodo.anio}`,
      monto: Number(c.monto_prorrateado),
    })
  }
  type CGC = { id: string; monto: number; periodo: { mes: number; anio: number } | null }
  for (const c of (cuentasGC ?? []) as CGC[]) {
    if (!c.periodo) continue
    movimientos.push({
      fecha: `${c.periodo.anio}-${String(c.periodo.mes).padStart(2, '0')}-01`,
      tipo: 'cargo', categoria: 'gc',
      concepto: `Cargo Gastos Comunes — ${meses[c.periodo.mes - 1]} ${c.periodo.anio}`,
      monto: Number(c.monto),
    })
  }
  type Mora = { id: string; descripcion: string; monto: number; tipo: string; fecha_origen: string | null }
  for (const m of (moras ?? []) as Mora[]) {
    movimientos.push({
      fecha: m.fecha_origen ?? '2026-01-01',
      tipo: 'cargo', categoria: 'mora',
      concepto: `Deuda anterior (${m.tipo === 'luz' ? 'Luz' : m.tipo === 'gc' ? 'GC' : 'Otro'}): ${m.descripcion}`,
      monto: Number(m.monto),
    })
  }
  type Pago = { id: string; monto: number; fecha: string; metodo: string; estado: string }
  for (const p of (pagosLuz ?? []) as Pago[]) {
    if (p.estado !== 'validado') continue
    movimientos.push({ fecha: p.fecha, tipo: 'pago', categoria: 'luz', concepto: `Pago Luz (${p.metodo})`, monto: Number(p.monto) })
  }
  for (const p of (pagosGC ?? []) as Pago[]) {
    if (p.estado !== 'validado') continue
    movimientos.push({ fecha: p.fecha, tipo: 'pago', categoria: 'gc', concepto: `Pago Gastos Comunes (${p.metodo})`, monto: Number(p.monto) })
  }
  // Abonos a moras: se reflejan como monto_pagado acumulado, sin fecha individual;
  // se muestran como un solo pago agregado por mora si corresponde.
  for (const m of (moras ?? []) as (Mora & { monto_pagado: number })[]) {
    if (Number(m.monto_pagado) > 0) {
      movimientos.push({ fecha: m.fecha_origen ?? '2026-01-01', tipo: 'pago', categoria: 'mora', concepto: `Abono deuda anterior: ${m.descripcion}`, monto: Number(m.monto_pagado) })
    }
  }

  movimientos.sort((a, b) => a.fecha.localeCompare(b.fecha))

  let saldoAcumulado = 0
  const movimientosConSaldo = movimientos.map(m => {
    saldoAcumulado += m.tipo === 'cargo' ? m.monto : -m.monto
    return { ...m, saldo_acumulado: saldoAcumulado }
  })

  const totalCargos = movimientos.filter(m => m.tipo === 'cargo').reduce((s, m) => s + m.monto, 0)
  const totalPagos = movimientos.filter(m => m.tipo === 'pago').reduce((s, m) => s + m.monto, 0)

  return NextResponse.json({
    parcela,
    movimientos: movimientosConSaldo,
    resumen: {
      total_cargos: totalCargos,
      total_pagos: totalPagos,
      saldo: totalCargos - totalPagos,
    },
  })
}
