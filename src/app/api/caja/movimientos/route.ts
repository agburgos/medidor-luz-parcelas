import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

export async function GET(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('caja_movimientos')
    .select('*')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const formData = await req.formData()
  const tipo = formData.get('tipo') as string
  const concepto = formData.get('concepto') as string
  const monto = formData.get('monto') as string
  const fecha = formData.get('fecha') as string
  const observacion = formData.get('observacion') as string
  const documento = formData.get('documento') as File | null

  if (!tipo || !concepto || !monto || !fecha) {
    return NextResponse.json({ error: 'Tipo, concepto, monto y fecha son requeridos' }, { status: 400 })
  }
  if (!['ingreso', 'egreso'].includes(tipo)) {
    return NextResponse.json({ error: 'Tipo debe ser ingreso o egreso' }, { status: 400 })
  }
  if (Number(monto) <= 0) {
    return NextResponse.json({ error: 'Monto debe ser positivo' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Subir documento a Storage si se proporciona
  let documento_url = null
  if (documento && documento.size > 0) {
    const nombreArchivo = `${Date.now()}-${documento.name}`
    const rutaBucket = `caja/${nombreArchivo}`
    const buffer = await documento.arrayBuffer()
    const { error: errUpload } = await supabase.storage
      .from('documentos')
      .upload(rutaBucket, buffer, { contentType: documento.type })
    if (errUpload) return NextResponse.json({ error: `Error al subir documento: ${errUpload.message}` }, { status: 400 })
    documento_url = rutaBucket
  }

  const { data, error } = await supabase
    .from('caja_movimientos')
    .insert({
      tipo,
      concepto,
      monto: Number(monto),
      fecha,
      documento_url,
      observacion: observacion || null,
      usuario_id: sesion.userId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'registrar_movimiento_caja', 'caja', data.id, {
    tipo, concepto, monto: Number(monto), fecha, con_documento: !!documento_url,
  })

  return NextResponse.json(data)
}
