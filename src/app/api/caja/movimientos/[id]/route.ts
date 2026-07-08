import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

// Elimina un movimiento de caja manual (ingreso/egreso extraordinario).
// Los movimientos originados por un pago (pago_id/pago_gc_id) NO se pueden
// borrar aquí: deben eliminarse desde el historial de pagos de la cuenta,
// para mantener caja, cuenta y pago siempre consistentes entre sí.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabase = createServiceClient()
  const { id } = await params

  const { data: mov } = await supabase
    .from('caja_movimientos')
    .select('id, concepto, monto, pago_id, pago_gc_id')
    .eq('id', id)
    .single()
  if (!mov) return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 })

  if (mov.pago_id || mov.pago_gc_id) {
    return NextResponse.json({
      error: 'Este movimiento proviene de un pago. Elimínalo desde el historial de pagos de la cuenta correspondiente.',
    }, { status: 400 })
  }

  const { error } = await supabase.from('caja_movimientos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'eliminar_movimiento_caja', 'caja', id, { concepto: mov.concepto, monto: mov.monto })

  return NextResponse.json({ ok: true })
}
