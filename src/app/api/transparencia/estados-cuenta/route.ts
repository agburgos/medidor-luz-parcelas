import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

// GET: resumen consolidado de deuda (sin identificar parcelas), para transparencia de parceleros
export async function GET() {
  const sesion = await getSesion()
  if (!sesion || !sesion.parcelaId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()

  const [{ data: parcelas }, { data: cuentasLuz }, { data: cuentasGC }, { data: moras }] = await Promise.all([
    supabase.from('parcelas').select('id').eq('activa', true),
    supabase.from('cuentas_parcela').select('parcela_id, monto_prorrateado, monto_pagado'),
    supabase.from('cuentas_gc').select('parcela_id, monto, monto_pagado'),
    supabase.from('moras_anteriores').select('parcela_id, monto, monto_pagado').neq('estado', 'pagado'),
  ])

  type CLuz = { parcela_id: string; monto_prorrateado: number; monto_pagado: number }
  type CGC = { parcela_id: string; monto: number; monto_pagado: number }
  type Mora = { parcela_id: string; monto: number; monto_pagado: number }

  const deudaPorParcela = new Map<string, number>()
  for (const c of (cuentasLuz ?? []) as CLuz[]) {
    const saldo = Math.max(Number(c.monto_prorrateado) - Number(c.monto_pagado), 0)
    deudaPorParcela.set(c.parcela_id, (deudaPorParcela.get(c.parcela_id) ?? 0) + saldo)
  }
  for (const c of (cuentasGC ?? []) as CGC[]) {
    const saldo = Math.max(Number(c.monto) - Number(c.monto_pagado), 0)
    deudaPorParcela.set(c.parcela_id, (deudaPorParcela.get(c.parcela_id) ?? 0) + saldo)
  }
  for (const m of (moras ?? []) as Mora[]) {
    const saldo = Math.max(Number(m.monto) - Number(m.monto_pagado), 0)
    deudaPorParcela.set(m.parcela_id, (deudaPorParcela.get(m.parcela_id) ?? 0) + saldo)
  }

  const totalParcelas = (parcelas ?? []).length
  let deudaTotal = 0
  let parcelasEnDeuda = 0
  for (const [, deuda] of deudaPorParcela) {
    if (deuda > 0) {
      deudaTotal += deuda
      parcelasEnDeuda++
    }
  }

  return NextResponse.json({
    totalParcelas,
    parcelasAlDia: totalParcelas - parcelasEnDeuda,
    parcelasEnDeuda,
    deudaTotalConsolidada: deudaTotal,
  })
}
