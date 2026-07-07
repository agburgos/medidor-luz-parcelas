import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

export async function GET() {
  const sesion = await getSesion()
  const supabase = createServiceClient()

  const [{ data: anuncios }, { data: archivos }, { data: reacciones }] = await Promise.all([
    supabase.from('anuncios').select('*').order('created_at', { ascending: false }),
    supabase.from('anuncio_archivos').select('*'),
    supabase.from('anuncio_reacciones').select('anuncio_id, tipo, parcela_id'),
  ])

  const archivosPorAnuncio = new Map<string, { tipo: string; url: string; nombre: string | null }[]>()
  for (const a of archivos ?? []) {
    const lista = archivosPorAnuncio.get(a.anuncio_id) ?? []
    lista.push({ tipo: a.tipo, url: a.url, nombre: a.nombre })
    archivosPorAnuncio.set(a.anuncio_id, lista)
  }

  const resultado = (anuncios ?? []).map((a: { id: string; [k: string]: unknown }) => {
    const reaccionesAnuncio = (reacciones ?? []).filter((r: { anuncio_id: string }) => r.anuncio_id === a.id)
    const likes = reaccionesAnuncio.filter((r: { tipo: string }) => r.tipo === 'like').length
    const dislikes = reaccionesAnuncio.filter((r: { tipo: string }) => r.tipo === 'dislike').length
    const miReaccion = sesion?.parcelaId
      ? reaccionesAnuncio.find((r: { parcela_id: string }) => r.parcela_id === sesion.parcelaId)?.tipo ?? null
      : null
    return {
      ...a,
      archivos: archivosPorAnuncio.get(a.id) ?? [],
      likes, dislikes, mi_reaccion: miReaccion,
    }
  })

  return NextResponse.json(resultado)
}

export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const fd = await req.formData()
  const titulo = fd.get('titulo') as string
  const contenido = (fd.get('contenido') as string) || null
  const fotos = fd.getAll('fotos') as File[]
  const documentos = fd.getAll('documentos') as File[]

  if (!titulo) return NextResponse.json({ error: 'Título requerido' }, { status: 400 })

  const { data: comunidad } = await supabase.from('comunidades').select('id').eq('activa', true).limit(1).single()

  const { data: anuncio, error } = await supabase
    .from('anuncios')
    .insert({ comunidad_id: comunidad?.id ?? null, titulo, contenido, created_by: sesion.userId })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  async function subirArchivos(files: File[], tipo: 'foto' | 'documento') {
    for (const file of files) {
      if (!file || file.size === 0) continue
      const ext = file.name.split('.').pop()
      const path = `anuncios/${anuncio.id}-${tipo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('archivos')
        .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type })
      if (upErr) continue
      const url = supabase.storage.from('archivos').getPublicUrl(path).data.publicUrl
      await supabase.from('anuncio_archivos').insert({ anuncio_id: anuncio.id, tipo, url, nombre: file.name })
    }
  }
  await Promise.all([subirArchivos(fotos, 'foto'), subirArchivos(documentos, 'documento')])

  await registrar(sesion, 'publicar_anuncio', 'anuncio', anuncio.id, { titulo })

  return NextResponse.json(anuncio)
}
