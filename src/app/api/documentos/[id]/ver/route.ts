import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

// Muestra una presentación HTML subida como documento. Storage entrega los .html
// como texto plano, así que se sirven desde aquí. Solo para el comité y dentro de
// un sandbox sin acceso al sitio ni a las cookies de la sesión.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const { data: doc } = await supabase.from('documentos').select('archivo_url').eq('id', id).maybeSingle()
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  const marca = '/object/public/archivos/'
  const idx = doc.archivo_url.indexOf(marca)
  const ruta = idx >= 0 ? decodeURIComponent(doc.archivo_url.slice(idx + marca.length)) : ''
  if (!ruta.toLowerCase().endsWith('.html')) return NextResponse.json({ error: 'El documento no es una presentación HTML' }, { status: 400 })

  const { data: archivo, error } = await supabase.storage.from('archivos').download(ruta)
  if (error || !archivo) return NextResponse.json({ error: 'No se pudo leer el archivo' }, { status: 400 })

  return new Response(await archivo.text(), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy':
        "sandbox allow-scripts allow-popups; default-src 'none'; script-src 'unsafe-inline'; " +
        "style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src https: data:",
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
