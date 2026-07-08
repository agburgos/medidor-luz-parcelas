import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

// POST: agregar una respuesta al hilo (comité o parcelero pueden replicar)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { respuesta, adjunto_url } = body
  if (!respuesta || !respuesta.trim()) {
    return NextResponse.json({ error: 'La respuesta no puede estar vacía' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: mensaje, error: errMensaje } = await supabase
    .from('mensajes')
    .select('id, parcela_id, tipo, asunto, estado')
    .eq('id', id)
    .single()

  if (errMensaje || !mensaje) return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 })

  if (sesion.rol !== 'comite' && mensaje.parcela_id !== sesion.parcelaId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  if (mensaje.estado === 'cerrado') {
    return NextResponse.json({ error: 'Este mensaje está cerrado y no admite más respuestas' }, { status: 400 })
  }

  const autor_tipo = sesion.rol === 'comite' ? 'comite' : 'parcelero'
  const autor_nombre = sesion.rol === 'comite' ? (sesion.nombre ?? sesion.cargo ?? 'Comité') : null

  const { data: nuevaRespuesta, error: errInsert } = await supabase
    .from('mensaje_respuestas')
    .insert({
      mensaje_id: id,
      autor_tipo,
      usuario_id: sesion.userId,
      autor_nombre,
      respuesta,
      adjunto_url: adjunto_url || null,
    })
    .select()
    .single()

  if (errInsert) return NextResponse.json({ error: errInsert.message }, { status: 400 })

  // Actualizar estado y marcas de lectura según quién respondió
  if (autor_tipo === 'comite') {
    await supabase.from('mensajes').update({
      estado: 'respondido',
      leido_parcelero: false,
      leido_comite: true,
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    await registrar(sesion, 'responder_mensaje', 'mensaje', id, {
      tipo: mensaje.tipo, asunto: mensaje.asunto, respuesta,
    })
  } else {
    await supabase.from('mensajes').update({
      estado: 'abierto',
      leido_comite: false,
      leido_parcelero: true,
      updated_at: new Date().toISOString(),
    }).eq('id', id)
  }

  return NextResponse.json(nuevaRespuesta)
}
