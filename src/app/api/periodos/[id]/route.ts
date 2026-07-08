import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

// Completa los datos de la factura cuando llega (monto, fechas, archivo).
// El período puede haberse creado antes, sin esta info, para empezar a
// recibir lecturas. Esto siempre debe hacerse antes de calcular el prorrateo.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params
  const supabase = createServiceClient()

  const { data: periodo } = await supabase
    .from('periodos_facturacion')
    .select('id, prorrateo_calculado')
    .eq('id', id)
    .single()
  if (!periodo) return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 })
  if (periodo.prorrateo_calculado) {
    return NextResponse.json({ error: 'El prorrateo ya fue calculado; no se puede editar la factura de este período' }, { status: 400 })
  }

  const contentType = req.headers.get('content-type') || ''
  const update: Record<string, unknown> = {}
  let archivo: File | null = null

  if (contentType.includes('multipart/form-data')) {
    const fd = await req.formData()
    if (fd.get('monto_total_factura') !== null) update.monto_total_factura = Number(fd.get('monto_total_factura'))
    if (fd.get('fecha_emision') !== null) update.fecha_emision = (fd.get('fecha_emision') as string) || null
    if (fd.get('fecha_vencimiento') !== null) update.fecha_vencimiento = (fd.get('fecha_vencimiento') as string) || null
    if (fd.get('fecha_corte') !== null) update.fecha_corte = (fd.get('fecha_corte') as string) || null
    if (fd.get('cargo_fijo') !== null) update.cargo_fijo = Number(fd.get('cargo_fijo'))
    archivo = fd.get('archivo') as File | null
  } else {
    const body = await req.json()
    if (body.monto_total_factura !== undefined) update.monto_total_factura = Number(body.monto_total_factura)
    if (body.fecha_emision !== undefined) update.fecha_emision = body.fecha_emision || null
    if (body.fecha_vencimiento !== undefined) update.fecha_vencimiento = body.fecha_vencimiento || null
    if (body.fecha_corte !== undefined) update.fecha_corte = body.fecha_corte || null
    if (body.cargo_fijo !== undefined) update.cargo_fijo = Number(body.cargo_fijo)
  }

  if (archivo && archivo.size > 0) {
    const ext = archivo.name.split('.').pop()
    const path = `facturas/${id}-${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('archivos')
      .upload(path, Buffer.from(await archivo.arrayBuffer()), { contentType: archivo.type })
    if (!uploadError) {
      update.archivo_factura_url = supabase.storage.from('archivos').getPublicUrl(path).data.publicUrl
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('periodos_facturacion')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'agregar_factura_periodo', 'periodo_facturacion', id, update)

  return NextResponse.json(data)
}
