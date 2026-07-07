import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('periodos_gc')
    .select('*')
    .order('anio', { ascending: false })
    .order('mes', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// Crea el período de GC y genera automáticamente las cuentas de todas las
// parcelas activas por el mismo valor (a diferencia de luz, no hay prorrateo).
export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const body = await req.json()
  const { mes, anio, valor_mensual, fecha_vencimiento, fecha_corte } = body

  if (!mes || !anio || !valor_mensual || !fecha_vencimiento) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const { data: comunidad } = await supabase.from('comunidades').select('id').eq('activa', true).limit(1).single()

  const { data: periodo, error } = await supabase
    .from('periodos_gc')
    .insert({
      comunidad_id: comunidad?.id ?? null,
      mes, anio,
      valor_mensual: Number(valor_mensual),
      fecha_vencimiento,
      fecha_corte: fecha_corte || null,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data: parcelas } = await supabase.from('parcelas').select('id').eq('activa', true)
  const cuentas = (parcelas ?? []).map((p: { id: string }) => ({
    periodo_gc_id: periodo.id,
    parcela_id: p.id,
    monto: Number(valor_mensual),
    monto_pagado: 0,
    estado: 'pendiente',
  }))
  if (cuentas.length > 0) {
    await supabase.from('cuentas_gc').upsert(cuentas, { onConflict: 'periodo_gc_id,parcela_id' })
  }

  await registrar(sesion, 'crear_periodo_gc', 'periodo_gc', periodo.id, { mes, anio, valor_mensual, parcelas: cuentas.length })

  return NextResponse.json({ ...periodo, cuentas_generadas: cuentas.length })
}
