import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

// Resumen de estado de cuenta de todas las parcelas (deuda Luz + GC + moras),
// para el menú de transparencia del comité.
export async function GET() {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabase = createServiceClient()

  const [{ data: parcelas }, { data: cuentasLuz }, { data: cuentasGC }, { data: moras }] = await Promise.all([
    supabase.from('parcelas').select('id, numero, nombre_dueno, email').eq('activa', true).order('numero'),
    supabase.from('cuentas_parcela').select('parcela_id, monto_prorrateado, monto_pagado'),
    supabase.from('cuentas_gc').select('parcela_id, monto, monto_pagado'),
    supabase.from('moras_anteriores').select('parcela_id, monto, monto_pagado').neq('estado', 'pagado'),
  ])

  type CLuz = { parcela_id: string; monto_prorrateado: number; monto_pagado: number }
  type CGC = { parcela_id: string; monto: number; monto_pagado: number }
  type Mora = { parcela_id: string; monto: number; monto_pagado: number }

  const deudaLuzPorParcela = new Map<string, number>()
  for (const c of (cuentasLuz ?? []) as CLuz[]) {
    const saldo = Math.max(Number(c.monto_prorrateado) - Number(c.monto_pagado), 0)
    deudaLuzPorParcela.set(c.parcela_id, (deudaLuzPorParcela.get(c.parcela_id) ?? 0) + saldo)
  }
  const deudaGCPorParcela = new Map<string, number>()
  for (const c of (cuentasGC ?? []) as CGC[]) {
    const saldo = Math.max(Number(c.monto) - Number(c.monto_pagado), 0)
    deudaGCPorParcela.set(c.parcela_id, (deudaGCPorParcela.get(c.parcela_id) ?? 0) + saldo)
  }
  const deudaMorasPorParcela = new Map<string, number>()
  for (const m of (moras ?? []) as Mora[]) {
    const saldo = Math.max(Number(m.monto) - Number(m.monto_pagado), 0)
    deudaMorasPorParcela.set(m.parcela_id, (deudaMorasPorParcela.get(m.parcela_id) ?? 0) + saldo)
  }

  type ParcelaRow = { id: string; numero: number; nombre_dueno: string; email: string | null }
  const resultado = (parcelas ?? []).map((p: ParcelaRow) => {
    const deudaLuz = deudaLuzPorParcela.get(p.id) ?? 0
    const deudaGC = deudaGCPorParcela.get(p.id) ?? 0
    const deudaMoras = deudaMorasPorParcela.get(p.id) ?? 0
    return {
      id: p.id,
      numero: p.numero,
      nombre_dueno: p.nombre_dueno,
      email: p.email,
      deuda_luz: deudaLuz,
      deuda_gc: deudaGC,
      deuda_moras: deudaMoras,
      deuda_total: deudaLuz + deudaGC + deudaMoras,
    }
  })

  return NextResponse.json(resultado)
}
