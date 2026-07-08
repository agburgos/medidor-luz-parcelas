import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

// Elimina un pago de Luz mal ingresado o duplicado.
// Al borrar el pago, su movimiento de caja vinculado se elimina en cascada
// (FK caja_movimientos.pago_id -> pagos.id on delete cascade).
// La cuenta se recalcula desde los pagos validados restantes.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabase = createServiceClient()
  const { id } = await params

  const { data: pago } = await supabase
    .from('pagos')
    .select('id, cuenta_id, monto')
    .eq('id', id)
    .single()
  if (!pago) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })

  const { data: cuenta } = await supabase
    .from('cuentas_parcela')
    .select('id, monto_prorrateado, periodo:periodos_facturacion(fecha_vencimiento)')
    .eq('id', pago.cuenta_id)
    .single()
  if (!cuenta) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })

  const { error: delError } = await supabase.from('pagos').delete().eq('id', id)
  if (delError) return NextResponse.json({ error: delError.message }, { status: 400 })

  // Recalcular la cuenta con los pagos validados restantes
  const { data: pagosRestantes } = await supabase
    .from('pagos')
    .select('monto')
    .eq('cuenta_id', pago.cuenta_id)
    .eq('estado', 'validado')

  const totalPagado = (pagosRestantes ?? []).reduce((s: number, p: { monto: number }) => s + Number(p.monto), 0)
  const venc = (cuenta.periodo as { fecha_vencimiento: string } | null)?.fecha_vencimiento
  const vencido = venc ? new Date(venc + 'T23:59:59') < new Date() : false
  const nuevoEstado = totalPagado >= cuenta.monto_prorrateado
    ? 'pagado'
    : totalPagado > 0 ? (vencido ? 'mora' : 'pago_parcial')
    : vencido ? 'mora' : 'pendiente'

  await supabase
    .from('cuentas_parcela')
    .update({ monto_pagado: totalPagado, estado: nuevoEstado })
    .eq('id', pago.cuenta_id)

  await registrar(sesion, 'eliminar_pago_luz', 'pago', id, { cuenta_id: pago.cuenta_id, monto_eliminado: pago.monto })

  return NextResponse.json({
    ok: true,
    monto_pagado: totalPagado,
    estado_cuenta: nuevoEstado,
    saldo: Math.max(cuenta.monto_prorrateado - totalPagado, 0),
  })
}
