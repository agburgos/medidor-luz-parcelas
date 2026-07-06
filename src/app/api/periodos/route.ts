import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  const fd = await req.formData()

  const mes = Number(fd.get('mes'))
  const anio = Number(fd.get('anio'))
  const monto_total_factura = Number(fd.get('monto_total_factura'))
  const costo_unitario_kwh = Number(fd.get('costo_unitario_kwh') || 0)
  const cargo_fijo = Number(fd.get('cargo_fijo') || 5500)
  const lectura_general_anterior = fd.get('lectura_general_anterior') ? Number(fd.get('lectura_general_anterior')) : null
  const lectura_general_actual = fd.get('lectura_general_actual') ? Number(fd.get('lectura_general_actual')) : null
  const fecha_vencimiento = fd.get('fecha_vencimiento') as string
  const fecha_emision = fd.get('fecha_emision') as string || null
  const fecha_corte = fd.get('fecha_corte') as string || null
  const archivo = fd.get('archivo') as File | null

  if (!mes || !anio || !monto_total_factura || !fecha_vencimiento) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  let archivo_factura_url = null
  if (archivo) {
    const ext = archivo.name.split('.').pop()
    const path = `facturas/${anio}-${String(mes).padStart(2,'0')}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('archivos')
      .upload(path, Buffer.from(await archivo.arrayBuffer()), {
        contentType: archivo.type,
        upsert: true,
      })
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('archivos').getPublicUrl(path)
      archivo_factura_url = urlData.publicUrl
    }
  }

  const { data, error } = await supabase
    .from('periodos_facturacion')
    .insert({
      mes, anio, monto_total_factura, fecha_vencimiento,
      costo_unitario_kwh, cargo_fijo,
      lectura_general_anterior, lectura_general_actual,
      fecha_emision: fecha_emision || undefined,
      fecha_corte: fecha_corte || undefined,
      archivo_factura_url,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
