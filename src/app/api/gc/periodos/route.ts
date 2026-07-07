import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('periodos_gc')
    .select('*')
    .order('anio', { ascending: false })
    .order('mes', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// Crea el período de GC y genera automáticamente las cuentas de todas las
// parcelas activas por el mismo valor (a diferencia de luz, no hay prorrateo).
export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const fd = await req.formData()
  const mes = Number(fd.get('mes'))
  const anio = Number(fd.get('anio'))
  const valor_mensual = fd.get('valor_mensual')
  const fecha_vencimiento = fd.get('fecha_vencimiento') as string | null
  const fecha_corte = fd.get('fecha_corte') as string | null
  const archivo = fd.get('archivo') as File | null

  if (!mes || !anio || !valor_mensual || !fecha_vencimiento) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  let documento_url: string | null = null
  if (archivo && archivo.size > 0) {
    const ext = archivo.name.split('.').pop()
    const path = `gc/${anio}-${String(mes).padStart(2, '0')}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('archivos')
      .upload(path, Buffer.from(await archivo.arrayBuffer()), {
        contentType: archivo.type,
        upsert: true,
      })
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('archivos').getPublicUrl(path)
      documento_url = urlData.publicUrl
    }
  }

  const { data: comunidad } = await supabase.from('comunidades').select('id').eq('activa', true).limit(1).single()

  const { data: periodo, error } = await supabase
    .from('periodos_gc')
    .insert({
      comunidad_id: comunidad?.id ?? null,
      mes, anio,
      valor_mensual: Number(valor_mensual),
      fecha_vencimiento,
      fecha_corte: fecha_corte || null,
      documento_url,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data: parcelas } = await supabase.from('parcelas').select('id').eq('activa', true)
  const cuentas = (parcelas ?? []).map((p: { id: string }) => ({
    periodo_gc_id: periodo.id,
    parcela_id: p.id,
    monto: Number(valor_mensual),
    monto_pagado: 0,
    estado: 'pendiente',
  }))
  if (cuentas.length > 0) {
    await supabase.from('cuentas_gc').upsert(cuentas, { onConflict: 'periodo_gc_id,parcela_id' })
  }

  await registrar(sesion, 'crear_periodo_gc', 'periodo_gc', periodo.id, { mes, anio, valor_mensual, parcelas: cuentas.length })

  return NextResponse.json({ ...periodo, cuentas_generadas: cuentas.length })
}
