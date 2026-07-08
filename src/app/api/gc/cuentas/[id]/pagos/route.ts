import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('pagos_gc')
    .select('*')
    .eq('cuenta_gc_id', id)
    .order('fecha', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// Registrar pago (comité), con comprobante opcional. Igual patrón que luz.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const sesion = await getSesion()

  let monto = 0, fecha: string | null = null, metodo = 'transferencia', observacion: string | null = null
  let comprobante: File | null = null

  const contentType = req.headers.get('content-type') || ''
  if (contentType.includes('multipart/form-data')) {
    const fd = await req.formData()
    monto = Number(fd.get('monto'))
    fecha = (fd.get('fecha') as string) || null
    metodo = (fd.get('metodo') as string) || 'transferencia'
    observacion = (fd.get('observacion') as string) || null
    comprobante = fd.get('comprobante') as File | null
  } else {
    const body = await req.json()
    monto = Number(body.monto)
    fecha = body.fecha || null
    metodo = body.metodo || 'transferencia'
    observacion = body.observacion || null
  }
  if (!monto || monto <= 0) return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })

  const { data: cuenta } = await supabase
    .from('cuentas_gc')
    .select('id, monto, monto_pagado, parcela:parcelas(numero), periodo:periodos_gc(fecha_vencimiento)')
    .eq('id', id)
    .single()
  if (!cuenta) return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })

  let comprobante_url = null
  if (comprobante && comprobante.size > 0) {
    const ext = comprobante.name.split('.').pop()
    const path = `comprobantes-gc/${id}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('archivos')
      .upload(path, Buffer.from(await comprobante.arrayBuffer()), { contentType: comprobante.type })
    if (!upErr) comprobante_url = supabase.storage.from('archivos').getPublicUrl(path).data.publicUrl
  }

  const fechaPago = fecha || new Date().toISOString().slice(0, 10)
  const { data: pagoInsertado, error: pagoError } = await supabase.from('pagos_gc').insert({
    cuenta_gc_id: id,
    monto,
    fecha: fechaPago,
    metodo,
    observacion,
    comprobante_url,
    estado: 'validado',
    reportado_por: sesion?.userId ?? null,
    validado_por: sesion?.userId ?? null,
    validado_en: new Date().toISOString(),
  }).select('id').single()
  if (pagoError) return NextResponse.json({ error: pagoError.message }, { status: 400 })

  // Registrar el ingreso en caja (recaudación de GC suma a la caja)
  const numeroParc = (cuenta.parcela as { numero: number } | null)?.numero ?? '?'
  await supabase.from('caja_movimientos').insert({
    tipo: 'ingreso',
    concepto: `Pago Gastos Comunes - Parcela #${numeroParc}`,
    monto,
    fecha: fechaPago,
    documento_url: comprobante_url,
    observacion: `Pago GC registrado por comité${observacion ? `: ${observacion}` : ''}`,
    pago_gc_id: pagoInsertado?.id ?? null,
  })

  const { data: pagos } = await supabase.from('pagos_gc').select('monto').eq('cuenta_gc_id', id).eq('estado', 'validado')
  const totalPagado = (pagos ?? []).reduce((s: number, p: { monto: number }) => s + Number(p.monto), 0)

  const venc = (cuenta.periodo as { fecha_vencimiento: string } | null)?.fecha_vencimiento
  const vencido = venc ? new Date(venc + 'T23:59:59') < new Date() : false
  const nuevoEstado = totalPagado >= cuenta.monto ? 'pagado' : vencido ? 'mora' : 'pago_parcial'

  await supabase
    .from('cuentas_gc')
    .update({ monto_pagado: totalPagado, estado: nuevoEstado, fecha_pago: fecha || new Date().toISOString().slice(0, 10) })
    .eq('id', id)

  await registrar(sesion, 'pago_gc', 'cuenta_gc', id, { monto })

  return NextResponse.json({ monto_pagado: totalPagado, estado: nuevoEstado, saldo: Math.max(cuenta.monto - totalPagado, 0) })
}
