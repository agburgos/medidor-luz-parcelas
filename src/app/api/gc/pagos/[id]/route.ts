import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion, esSuperadmin } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

// Elimina un pago de Gastos Comunes mal ingresado o duplicado. Solo superadmin.
// Al borrar el pago, su movimiento de caja vinculado se elimina en cascada
// (FK caja_movimientos.pago_gc_id -> pagos_gc.id on delete cascade).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion || !esSuperadmin(sesion)) {
    return NextResponse.json({ error: 'Solo un superadministrador puede eliminar pagos' }, { status: 403 })
  }

  const supabase = createServiceClient()
  const { id } = await params

  const { data: pago } = await supabase
    .from('pagos_gc')
    .select('id, cuenta_gc_id, monto')
    .eq('id', id)
    .single()
  if (!pago) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })

  const { data: cuenta } = await supabase
    .from('cuentas_gc')
    .select('id, monto, periodo:periodos_gc(fecha_vencimiento)')
    .eq('id', pago.cuenta_gc_id)
    .single()
  if (!cuenta) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })

  const { error: delError } = await supabase.from('pagos_gc').delete().eq('id', id)
  if (delError) return NextResponse.json({ error: delError.message }, { status: 400 })

  const { data: pagosRestantes } = await supabase
    .from('pagos_gc')
    .select('monto')
    .eq('cuenta_gc_id', pago.cuenta_gc_id)
    .eq('estado', 'validado')

  const totalPagado = (pagosRestantes ?? []).reduce((s: number, p: { monto: number }) => s + Number(p.monto), 0)
  const venc = (cuenta.periodo as { fecha_vencimiento: string } | null)?.fecha_vencimiento
  const vencido = venc ? new Date(venc + 'T23:59:59') < new Date() : false
  const nuevoEstado = totalPagado >= cuenta.monto
    ? 'pagado'
    : totalPagado > 0 ? (vencido ? 'mora' : 'pago_parcial')
    : vencido ? 'mora' : 'pendiente'

  await supabase
    .from('cuentas_gc')
    .update({ monto_pagado: totalPagado, estado: nuevoEstado })
    .eq('id', pago.cuenta_gc_id)

  await registrar(sesion, 'eliminar_pago_gc', 'pago_gc', id, { cuenta_gc_id: pago.cuenta_gc_id, monto_eliminado: pago.monto })

  return NextResponse.json({
    ok: true,
    monto_pagado: totalPagado,
    estado_cuenta: nuevoEstado,
    saldo: Math.max(cuenta.monto - totalPagado, 0),
  })
}
