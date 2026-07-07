import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

export async function GET(req: NextRequest) {
  const supabase = createServiceClient()
  const asambleaId = req.nextUrl.searchParams.get('asamblea_id')
  const categoria = req.nextUrl.searchParams.get('categoria')

  let query = supabase.from('documentos').select('*').order('created_at', { ascending: false })
  if (asambleaId) query = query.eq('asamblea_id', asambleaId)
  if (categoria) query = query.eq('categoria', categoria)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const fd = await req.formData()
  const archivo = fd.get('archivo') as File | null
  const nombre = fd.get('nombre') as string
  const categoria = (fd.get('categoria') as string) || 'general'
  const asamblea_id = (fd.get('asamblea_id') as string) || null

  if (!archivo || !nombre) return NextResponse.json({ error: 'Archivo y nombre son requeridos' }, { status: 400 })

  const { data: comunidad } = await supabase.from('comunidades').select('id').eq('activa', true).limit(1).single()

  const ext = archivo.name.split('.').pop()
  const path = `documentos/${Date.now()}-${archivo.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  const { error: upErr } = await supabase.storage
    .from('archivos')
    .upload(path, Buffer.from(await archivo.arrayBuffer()), { contentType: archivo.type })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })
  const archivo_url = supabase.storage.from('archivos').getPublicUrl(path).data.publicUrl

  const { data, error } = await supabase
    .from('documentos')
    .insert({
      comunidad_id: comunidad?.id ?? null,
      asamblea_id,
      categoria,
      nombre,
      archivo_url,
      subido_por: sesion.userId,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'subir_documento', 'documento', data.id, { nombre, categoria })
  return NextResponse.json(data)
}
