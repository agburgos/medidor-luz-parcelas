import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

// El comité valida o rechaza un pago informado.
// Solo los pagos VALIDADOS suman al saldo de la cuenta.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = createServiceClient()
  const { accion } = await req.json()
  if (!['validar', 'rechazar'].includes(accion)) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  const { data: pago } = await supabase
    .from('pagos')
    .select('id, cuenta_id, estado, monto, fecha, cuenta:cuentas_parcela(parcela:parcelas(numero))')
    .eq('id', id)
    .single()
  if (!pago) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })

  const { error: updErr } = await supabase
    .from('pagos')
    .update({
      estado: accion === 'validar' ? 'validado' : 'rechazado',
      validado_por: user.id,
      validado_en: new Date().toISOString(),
    })
    .eq('id', id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

  // Recalcular la cuenta con SOLO los pagos validados
  const { data: cuenta } = await supabase
    .from('cuentas_parcela')
    .select('id, monto_prorrateado, estado, periodo:periodos_facturacion(fecha_vencimiento)')
    .eq('id', pago.cuenta_id)
    .single()

  const { data: pagosValidados } = await supabase
    .from('pagos')
    .select('monto, fecha')
    .eq('cuenta_id', pago.cuenta_id)
    .eq('estado', 'validado')

  const totalPagado = (pagosValidados ?? []).reduce((s: number, p: { monto: number }) => s + Number(p.monto), 0)
  // Con saldo pendiente: mora si el período venció, pago parcial si no.
  const venc = (cuenta?.periodo as { fecha_vencimiento: string } | null)?.fecha_vencimiento
  const vencido = venc ? new Date(venc + 'T23:59:59') < new Date() : false
  const nuevoEstado = cuenta && totalPagado >= cuenta.monto_prorrateado
    ? 'pagado'
    : totalPagado > 0 ? (vencido ? 'mora' : 'pago_parcial')
    : vencido || cuenta?.estado === 'mora' ? 'mora' : 'pendiente'

  await supabase
    .from('cuentas_parcela')
    .update({ monto_pagado: totalPagado, estado: nuevoEstado })
    .eq('id', pago.cuenta_id)

  // Si es validación de pago (no rechazo), registrar en CAJA como INGRESO
  if (accion === 'validar' && pago.monto && pago.monto > 0) {
    const numeroParc = (pago.cuenta as any)?.parcela?.numero || '?'
    const { error: errCaja } = await supabase
      .from('caja_movimientos')
      .insert({
        tipo: 'ingreso',
        concepto: `Pago Luz - Parcela #${numeroParc}`,
        monto: Number(pago.monto),
        fecha: pago.fecha || new Date().toISOString().slice(0, 10),
        observacion: `Pago validado de parcela #${numeroParc}`,
        usuario_id: user.id,
        pago_id: pago.id,
      })
    if (errCaja) console.error('Error al registrar pago en caja:', errCaja.message)
  }

  const sesion = await getSesion()
  await registrar(sesion, accion === 'validar' ? 'validar_pago' : 'rechazar_pago', 'pago', id, { cuenta_id: pago.cuenta_id, registrado_en_caja: accion === 'validar' })

  return NextResponse.json({ ok: true, monto_pagado: totalPagado, estado_cuenta: nuevoEstado })
}
