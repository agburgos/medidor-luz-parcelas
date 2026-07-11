import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

// Subir fotos/documentos posteriores al hecho (comité o el dueño de la parcela involucrada)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = createServiceClient()
  const { data: incidencia } = await supabase.from('incidencias').select('id, parcela_id').eq('id', id).maybeSingle()
  if (!incidencia) return NextResponse.json({ error: 'Incidencia no encontrada' }, { status: 404 })

  const puedeSubir = sesion.rol === 'comite' || sesion.parcelaId === incidencia.parcela_id
  if (!puedeSubir) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const fd = await req.formData()
  const archivo = fd.get('archivo') as File | null
  const tipo = (fd.get('tipo') as string) || 'foto'

  if (!archivo || archivo.size === 0) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 })

  const ext = archivo.name.split('.').pop()
  const path = `incidencias/${id}-${Date.now()}.${ext}`
  const { error: upErr } = await supabase.storage
    .from('archivos')
    .upload(path, Buffer.from(await archivo.arrayBuffer()), { contentType: archivo.type })
  if (upErr) return NextResponse.json({ error: `Error subiendo archivo: ${upErr.message}` }, { status: 400 })
  const archivo_url = supabase.storage.from('archivos').getPublicUrl(path).data.publicUrl

  const { data, error } = await supabase
    .from('incidencia_documentos')
    .insert({ incidencia_id: id, archivo_url, tipo, subido_por: sesion.userId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'subir_documento_incidencia', 'incidencia', id, { tipo })
  return NextResponse.json(data)
}
