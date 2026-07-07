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
  const { accion } = await req.json()
  if (!['validar', 'rechazar'].includes(accion)) {
    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
  }

  const { data: pago } = await supabase
    .from('pagos_gc')
    .select('id, cuenta_gc_id, estado')
    .eq('id', id)
    .single()
  if (!pago) return NextResponse.json({ error: 'Pago no encontrado' }, { status: 404 })

  const { error: updErr } = await supabase
    .from('pagos_gc')
    .update({
      estado: accion === 'validar' ? 'validado' : 'rechazado',
      validado_por: user.id,
      validado_en: new Date().toISOString(),
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

  const sesion = await getSesion()
  await registrar(sesion, accion === 'validar' ? 'validar_pago_gc' : 'rechazar_pago_gc', 'pago_gc', id, { cuenta_gc_id: pago.cuenta_gc_id })

  return NextResponse.json({ ok: true, monto_pagado: totalPagado, estado_cuenta: nuevoEstado })
}
