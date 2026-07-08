import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

// GET: saldo inicial de caja (fuente única de verdad: tabla caja_saldos)
export async function GET() {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('caja_saldos')
    .select('id, fecha, saldo_final')
    .order('fecha', { ascending: true })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ saldo_inicial: data?.saldo_final ?? 0 })
}

// PATCH: corregir el saldo inicial (solo comité)
export async function PATCH(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { saldo_inicial } = await req.json()
  if (typeof saldo_inicial !== 'number' || isNaN(saldo_inicial)) {
    return NextResponse.json({ error: 'saldo_inicial inválido' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: existente } = await supabase
    .from('caja_saldos')
    .select('id, saldo_final')
    .order('fecha', { ascending: true })
    .limit(1)
    .maybeSingle()

  const valorAnterior = existente?.saldo_final ?? null

  if (existente) {
    const { error } = await supabase.from('caja_saldos').update({ saldo_final: saldo_inicial }).eq('id', existente.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  } else {
    const { error } = await supabase.from('caja_saldos').insert({
      fecha: new Date().toISOString().slice(0, 10),
      saldo_inicial: 0,
      saldo_final: saldo_inicial,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await registrar(sesion, 'editar_saldo_inicial', 'caja_saldos', existente?.id, {
    valor_anterior: valorAnterior, valor_nuevo: saldo_inicial,
  })

  return NextResponse.json({ ok: true, saldo_inicial })
}
