import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

// Registra un abono nuevo, no asociado a ningún período, que se aplica
// automáticamente (FIFO) a la mora anterior pendiente más antigua de la
// parcela hasta agotar el monto del abono.
export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json()
  const { parcela_id, monto, fecha, descripcion, tipo } = body
  if (!parcela_id || !monto || Number(monto) <= 0) {
    return NextResponse.json({ error: 'Parcela y monto son requeridos' }, { status: 400 })
  }

  const supabase = createServiceClient()

  let query = supabase
    .from('moras_anteriores')
    .select('*')
    .eq('parcela_id', parcela_id)
    .neq('estado', 'pagado')
    .order('fecha_origen', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  if (tipo && ['luz', 'gc', 'otro'].includes(tipo)) query = query.eq('tipo', tipo)

  const { data: moras, error: errMoras } = await query
  if (errMoras) return NextResponse.json({ error: errMoras.message }, { status: 400 })

  let restante = Number(monto)
  const aplicaciones: { id: string; descripcion: string; aplicado: number; nuevo_estado: string }[] = []

  for (const m of moras ?? []) {
    if (restante <= 0) break
    const saldo = Number(m.monto) - Number(m.monto_pagado)
    if (saldo <= 0) continue
    const aplicado = Math.min(saldo, restante)
    const nuevoPagado = Number(m.monto_pagado) + aplicado
    const nuevoEstado = nuevoPagado >= Number(m.monto) ? 'pagado' : 'pago_parcial'

    const { error: errUpdate } = await supabase
      .from('moras_anteriores')
      .update({ monto_pagado: nuevoPagado, estado: nuevoEstado })
      .eq('id', m.id)
    if (errUpdate) return NextResponse.json({ error: errUpdate.message }, { status: 400 })

    aplicaciones.push({ id: m.id, descripcion: m.descripcion, aplicado, nuevo_estado: nuevoEstado })
    restante -= aplicado
  }

  await registrar(sesion, 'abono_general', 'parcela', parcela_id, {
    monto: Number(monto), fecha, descripcion, tipo, aplicaciones, sobrante_sin_aplicar: restante,
  })

  return NextResponse.json({
    aplicado_total: Number(monto) - restante,
    sobrante_sin_aplicar: restante,
    aplicaciones,
  })
}
