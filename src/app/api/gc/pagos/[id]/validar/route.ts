import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

// El comité valida o rechaza un pago de Gastos Comunes informado por el parcelero.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = createServiceClient()
  const { accion, motivo } = await req.json()
  if (!['validar', 'rechazar'].includes(accion)) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }
  if (accion === 'rechazar' && !motivo) {
    return NextResponse.json({ error: 'Debes indicar el motivo del rechazo' }, { status: 400 })
  }

  const { data: pago } = await supabase
    .from('pagos_gc')
    .select('id, cuenta_gc_id, estado, monto, fecha, cuenta:cuentas_gc(parcela:parcelas(numero))')
    .eq('id', id)
    .single()
  if (!pago) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })

  // Idempotencia: si ya estaba en el estado pedido (doble clic, reintento de
  // red), no reprocesar — evita duplicar el movimiento de caja.
  const yaEstabaEnEseEstado = (accion === 'validar' && pago.estado === 'validado') || (accion === 'rechazar' && pago.estado === 'rechazado')
  if (yaEstabaEnEseEstado) {
    return NextResponse.json({ ok: true, ya_procesado: true })
  }

  const { error: updErr } = await supabase
    .from('pagos_gc')
    .update({
      estado: accion === 'validar' ? 'validado' : 'rechazado',
      validado_por: user.id,
      validado_en: new Date().toISOString(),
      motivo_rechazo: accion === 'rechazar' ? motivo : null,
    })
    .eq('id', id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

  const { data: cuenta } = await supabase
    .from('cuentas_gc')
    .select('id, monto, estado, periodo:periodos_gc(fecha_vencimiento)')
    .eq('id', pago.cuenta_gc_id)
    .single()

  const { data: pagosValidados } = await supabase
    .from('pagos_gc')
    .select('monto')
    .eq('cuenta_gc_id', pago.cuenta_gc_id)
    .eq('estado', 'validado')

  const totalPagado = (pagosValidados ?? []).reduce((s: number, p: { monto: number }) => s + Number(p.monto), 0)
  const venc = (cuenta?.periodo as { fecha_vencimiento: string } | null)?.fecha_vencimiento
  const vencido = venc ? new Date(venc + 'T23:59:59') < new Date() : false
  const nuevoEstado = cuenta && totalPagado >= cuenta.monto
    ? 'pagado'
    : totalPagado > 0 ? (vencido ? 'mora' : 'pago_parcial')
    : vencido || cuenta?.estado === 'mora' ? 'mora' : 'pendiente'

  await supabase
    .from('cuentas_gc')
    .update({ monto_pagado: totalPagado, estado: nuevoEstado })
    .eq('id', pago.cuenta_gc_id)

  // Si es validación de pago (no rechazo), registrar en CAJA como INGRESO
  // (solo si no existe ya un movimiento para este pago — evita duplicados)
  const { count: cajaExistenteGC } = await supabase
    .from('caja_movimientos')
    .select('id', { count: 'exact', head: true })
    .eq('pago_gc_id', pago.id)
  if (accion === 'validar' && pago.monto && pago.monto > 0 && !cajaExistenteGC) {
    const numeroParc = (pago.cuenta as any)?.parcela?.numero || '?'
    const { error: errCaja } = await supabase
      .from('caja_movimientos')
      .insert({
        tipo: 'ingreso',
        concepto: `Pago Gastos Comunes - Parcela #${numeroParc}`,
        monto: Number(pago.monto),
        fecha: pago.fecha || new Date().toISOString().slice(0, 10),
        observacion: `Pago GC validado de parcela #${numeroParc}`,
        usuario_id: user.id,
        pago_gc_id: pago.id,
      })
    if (errCaja) console.error('Error al registrar pago GC en caja:', errCaja.message)
  }

  const sesion = await getSesion()
  await registrar(sesion, accion === 'validar' ? 'validar_pago_gc' : 'rechazar_pago_gc', 'pago_gc', id, { cuenta_gc_id: pago.cuenta_gc_id, registrado_en_caja: accion === 'validar', motivo: accion === 'rechazar' ? motivo : undefined })

  return NextResponse.json({ ok: true, monto_pagado: totalPagado, estado_cuenta: nuevoEstado })
}
