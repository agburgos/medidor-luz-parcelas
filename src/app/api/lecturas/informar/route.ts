import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

// Estado de mi lectura del período abierto (parcelero)
export async function GET() {
  const sesion = await getSesion()
  if (!sesion || !sesion.parcelaId) return NextResponse.json({ error: 'Sin parcela' }, { status: 403 })

  const supabase = createServiceClient()

  // Si la parcela no tiene empalme, no participa del cálculo de consumo
  const { data: miParcela } = await supabase
    .from('parcelas')
    .select('tiene_empalme')
    .eq('id', sesion.parcelaId)
    .single()
  if (miParcela && miParcela.tiene_empalme === false) {
    return NextResponse.json({ periodo: null, sin_empalme: true })
  }

  const { data: periodo } = await supabase
    .from('periodos_facturacion')
    .select('id, mes, anio')
    .eq('estado', 'abierto')
    .order('anio', { ascending: false })
    .order('mes', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!periodo) return NextResponse.json({ periodo: null })

  const [{ data: lectura }, { data: config }, { data: lecturaAnterior }] = await Promise.all([
    supabase
      .from('lecturas')
      .select('id, lectura_actual, lectura_anterior, estado_validacion, motivo_rechazo, foto_url, origen')
      .eq('periodo_id', periodo.id)
      .eq('parcela_id', sesion.parcelaId)
      .maybeSingle(),
    supabase.from('config_alertas').select('dia_tope_lectura').limit(1).maybeSingle(),
    // lectura anterior = lectura del período previo
    (async () => {
      const fechaPrev = new Date(periodo.anio, periodo.mes - 2)
      const { data: prev } = await supabase
        .from('periodos_facturacion')
        .select('id')
        .eq('mes', fechaPrev.getMonth() + 1)
        .eq('anio', fechaPrev.getFullYear())
        .maybeSingle()
      if (!prev) return { data: null }
      return supabase
        .from('lecturas')
        .select('lectura_actual')
        .eq('periodo_id', prev.id)
        .eq('parcela_id', sesion.parcelaId!)
        .maybeSingle()
    })(),
  ])

  const diaTope = config?.dia_tope_lectura ?? 10
  const fechaTope = new Date(periodo.anio, periodo.mes - 1, diaTope)

  return NextResponse.json({
    periodo,
    fecha_tope: fechaTope.toISOString().slice(0, 10),
    lectura_anterior: lectura?.lectura_anterior ?? lecturaAnterior?.lectura_actual ?? 0,
    mi_lectura: lectura,
  })
}

// Subir/reenviar mi lectura con foto obligatoria (parcelero)
export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || !sesion.parcelaId) return NextResponse.json({ error: 'Sin parcela vinculada' }, { status: 403 })

  const supabase = createServiceClient()

  // Bloquear subida si la parcela no tiene empalme
  const { data: miParcela } = await supabase
    .from('parcelas')
    .select('tiene_empalme')
    .eq('id', sesion.parcelaId)
    .single()
  if (miParcela && miParcela.tiene_empalme === false) {
    return NextResponse.json({ error: 'Tu parcela no tiene empalme eléctrico, no registra consumo' }, { status: 400 })
  }

  const fd = await req.formData()

  const periodo_id = fd.get('periodo_id') as string
  const lectura_actual = Number(fd.get('lectura_actual'))
  const foto = fd.get('foto') as File | null

  if (!periodo_id || isNaN(lectura_actual)) {
    return NextResponse.json({ error: 'Lectura y período requeridos' }, { status: 400 })
  }
  if (!foto || foto.size === 0) {
    return NextResponse.json({ error: 'La foto del medidor es obligatoria como respaldo' }, { status: 400 })
  }

  // Verificar que no exista ya una lectura aprobada
  const { data: existente } = await supabase
    .from('lecturas')
    .select('id, estado_validacion, lectura_anterior')
    .eq('periodo_id', periodo_id)
    .eq('parcela_id', sesion.parcelaId)
    .maybeSingle()

  if (existente?.estado_validacion === 'aprobada') {
    return NextResponse.json({ error: 'Tu lectura ya fue aprobada por el comité; contacta a la directiva si necesitas corregirla' }, { status: 400 })
  }

  // Subir foto
  const ext = foto.name.split('.').pop()
  const path = `lecturas/${periodo_id}-${sesion.parcelaId}-${Date.now()}.${ext}`
  const { error: upErr } = await supabase.storage
    .from('archivos')
    .upload(path, Buffer.from(await foto.arrayBuffer()), { contentType: foto.type })
  if (upErr) return NextResponse.json({ error: `Error subiendo la foto: ${upErr.message}` }, { status: 400 })
  const foto_url = supabase.storage.from('archivos').getPublicUrl(path).data.publicUrl

  // Lectura anterior automática (del período previo) si no existe registro
  let lectura_anterior = existente?.lectura_anterior
  if (lectura_anterior == null) {
    const { data: periodo } = await supabase
      .from('periodos_facturacion')
      .select('mes, anio')
      .eq('id', periodo_id)
      .single()
    lectura_anterior = 0
    if (periodo) {
      const fechaPrev = new Date(periodo.anio, periodo.mes - 2)
      const { data: prev } = await supabase
        .from('periodos_facturacion')
        .select('id')
        .eq('mes', fechaPrev.getMonth() + 1)
        .eq('anio', fechaPrev.getFullYear())
        .maybeSingle()
      if (prev) {
        const { data: lPrev } = await supabase
          .from('lecturas')
          .select('lectura_actual')
          .eq('periodo_id', prev.id)
          .eq('parcela_id', sesion.parcelaId)
          .maybeSingle()
        lectura_anterior = lPrev?.lectura_actual ?? 0
      }
    }
  }

  const { error } = await supabase
    .from('lecturas')
    .upsert({
      periodo_id,
      parcela_id: sesion.parcelaId,
      lectura_actual,
      lectura_anterior,
      foto_url,
      origen: 'parcelero',
      estado_validacion: 'pendiente',
      motivo_rechazo: null,
      confirmado: false,
      estado: 'normal',
    }, { onConflict: 'periodo_id,parcela_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (sesion.suplantando) {
    await registrar(sesion, 'subir_lectura_suplantando', 'lectura', periodo_id, {
      parcela_suplantada: sesion.suplantando.numero, lectura_actual,
    })
  }

  return NextResponse.json({ ok: true, mensaje: 'Lectura enviada. El comité la validará con tu foto.' })
}
