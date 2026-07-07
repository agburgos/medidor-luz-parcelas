import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

// El parcelero informa un pago indicando si el comprobante corresponde a
// Luz, Gastos Comunes o ambos (una sola transferencia que cubre los dos).
// Cada concepto queda "por_validar" en su propia tabla hasta que el comité
// lo apruebe; no afecta el saldo hasta ese momento.
export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || !sesion.parcelaId) return NextResponse.json({ error: 'Sin parcela vinculada' }, { status: 403 })

  const supabase = createServiceClient()
  const fd = await req.formData()

  const aplica_a = fd.get('aplica_a') as string
  const montoLuz = Number(fd.get('monto_luz') || 0)
  const montoGC = Number(fd.get('monto_gc') || 0)
  const fecha = (fd.get('fecha') as string) || new Date().toISOString().slice(0, 10)
  const metodo = (fd.get('metodo') as string) || 'transferencia'
  const observacion = (fd.get('observacion') as string) || null
  const comprobante = fd.get('comprobante') as File | null

  if (!['luz', 'gc', 'ambos'].includes(aplica_a)) {
    return NextResponse.json({ error: 'Debes indicar si el comprobante es de Luz, Gastos Comunes o Ambos' }, { status: 400 })
  }
  const incluyeLuz = aplica_a === 'luz' || aplica_a === 'ambos'
  const incluyeGC = aplica_a === 'gc' || aplica_a === 'ambos'
  if (incluyeLuz && (!montoLuz || montoLuz <= 0)) {
    return NextResponse.json({ error: 'Ingresa el monto correspondiente a Luz' }, { status: 400 })
  }
  if (incluyeGC && (!montoGC || montoGC <= 0)) {
    return NextResponse.json({ error: 'Ingresa el monto correspondiente a Gastos Comunes' }, { status: 400 })
  }
  if (!comprobante || comprobante.size === 0) {
    return NextResponse.json({ error: 'El comprobante es obligatorio' }, { status: 400 })
  }

  const comprobanteBuffer = Buffer.from(await comprobante.arrayBuffer())
  const ext = comprobante.name.split('.').pop()

  async function subirComprobante(prefijo: string) {
    const path = `comprobantes/${prefijo}-${sesion!.parcelaId}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('archivos').upload(path, comprobanteBuffer, { contentType: comprobante!.type })
    if (error) return null
    return supabase.storage.from('archivos').getPublicUrl(path).data.publicUrl
  }

  const combinado = aplica_a === 'ambos'
  const resultado: { luz?: string; gc?: string } = {}

  if (incluyeLuz) {
    const { data: cuenta } = await supabase
      .from('cuentas_parcela')
      .select('id, periodo:periodos_facturacion(mes,anio)')
      .eq('parcela_id', sesion.parcelaId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!cuenta) return NextResponse.json({ error: 'No tienes cuentas de luz generadas aún' }, { status: 400 })

    const url = await subirComprobante('luz')
    const { error } = await supabase.from('pagos').insert({
      cuenta_id: cuenta.id, monto: montoLuz, fecha, metodo, observacion,
      comprobante_url: url, estado: 'por_validar', reportado_por: sesion.userId, combinado,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    resultado.luz = 'informado'
  }

  if (incluyeGC) {
    const { data: cuenta } = await supabase
      .from('cuentas_gc')
      .select('id, periodo:periodos_gc(mes,anio)')
      .eq('parcela_id', sesion.parcelaId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!cuenta) return NextResponse.json({ error: 'No tienes cuentas de Gastos Comunes generadas aún' }, { status: 400 })

    const url = await subirComprobante('gc')
    const { error } = await supabase.from('pagos_gc').insert({
      cuenta_gc_id: cuenta.id, monto: montoGC, fecha, metodo, observacion,
      comprobante_url: url, estado: 'por_validar', reportado_por: sesion.userId, combinado,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    resultado.gc = 'informado'
  }

  return NextResponse.json({
    ok: true,
    mensaje: combinado
      ? 'Pago informado para Luz y Gastos Comunes. El comité validará ambos.'
      : `Pago informado para ${incluyeLuz ? 'Luz' : 'Gastos Comunes'}. El comité lo validará.`,
    resultado,
  })
}
