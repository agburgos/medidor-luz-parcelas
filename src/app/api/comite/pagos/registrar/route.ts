import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

// Admin/Comité registra pago de luz directamente → VALIDADO AUTOMÁTICO
export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const supabase = createServiceClient()
  const fd = await req.formData()

  const cuenta_id = fd.get('cuenta_id') as string
  const monto = Number(fd.get('monto'))
  const fecha = (fd.get('fecha') as string) || new Date().toISOString().slice(0, 10)
  const metodo = (fd.get('metodo') as string) || 'transferencia'
  const observacion = (fd.get('observacion') as string) || null
  const comprobante = fd.get('comprobante') as File | null

  if (!cuenta_id || !monto || monto <= 0) {
    return NextResponse.json({ error: 'Cuenta y monto son requeridos' }, { status: 400 })
  }

  // Verificar que la cuenta existe
  const { data: cuenta } = await supabase
    .from('cuentas_parcela')
    .select('id, parcela:parcelas(numero)')
    .eq('id', cuenta_id)
    .single()

  if (!cuenta) {
    return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })
  }

  let comprobante_url = null
  if (comprobante && comprobante.size > 0) {
    const ext = comprobante.name.split('.').pop()
    const path = `comprobantes/${cuenta_id}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('archivos')
      .upload(path, Buffer.from(await comprobante.arrayBuffer()), { contentType: comprobante.type })
    if (!upErr) {
      comprobante_url = path
    }
  }

  // Registrar pago con estado VALIDADO automáticamente
  const { data, error } = await supabase.from('pagos').insert({
    cuenta_id,
    monto,
    fecha,
    metodo,
    observacion,
    comprobante_url,
    estado: 'validado', // Auto-validado porque lo sube admin
    reportado_por: sesion.userId,
    validado_por: sesion.userId,
    validado_en: new Date().toISOString(),
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Auto-actualizar la cuenta (igual que en validación manual)
  const { data: cuentaData } = await supabase
    .from('cuentas_parcela')
    .select('monto_prorrateado, monto_pagado')
    .eq('id', cuenta_id)
    .single()

  const newMontoPagado = (cuentaData?.monto_pagado || 0) + monto
  const estado = newMontoPagado >= (cuentaData?.monto_prorrateado || 0) ? 'pagado' : 'pago_parcial'

  await supabase.from('cuentas_parcela').update({
    monto_pagado: newMontoPagado,
    estado,
  }).eq('id', cuenta_id)

  // Registrar en caja (mismo flujo que validación manual)
  await supabase.from('caja_movimientos').insert({
    tipo: 'ingreso',
    concepto: `Pago Luz - Parcela #${(cuenta.parcela as any)?.numero || '?'}`,
    monto,
    fecha,
    observacion: `Registrado por admin (comprobante: ${comprobante_url ? 'sí' : 'no'})`,
    usuario_id: sesion.userId,
    pago_id: data.id,
  })

  await registrar(sesion, 'registrar_pago_luz_admin', 'pagos', data.id, {
    monto, cuenta_id, con_comprobante: !!comprobante_url, validado_automaticamente: true,
  })

  return NextResponse.json({
    ok: true,
    pago: data,
    estado_cuenta: estado,
    mensaje: `✅ Pago registrado y validado automáticamente. Parcela #${(cuenta.parcela as any)?.numero} - Saldo: $${newMontoPagado}`,
  })
}
