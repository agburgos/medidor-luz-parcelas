import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

// GET: detalle del mensaje con su hilo de respuestas
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: mensaje, error } = await supabase
    .from('mensajes')
    .select('id, parcela_id, tipo, asunto, mensaje, adjunto_url, estado, leido_parcelero, leido_comite, created_at, updated_at, parcela:parcelas(id, numero, nombre_dueno)')
    .eq('id', id)
    .single()

  if (error || !mensaje) return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 })

  const esMiParcela = mensaje.parcela_id === sesion.parcelaId
  if (sesion.rol !== 'comite' && !esMiParcela) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data: respuestas, error: errResp } = await supabase
    .from('mensaje_respuestas')
    .select('id, autor_tipo, autor_nombre, respuesta, adjunto_url, created_at')
    .eq('mensaje_id', id)
    .order('created_at', { ascending: true })

  if (errResp) return NextResponse.json({ error: errResp.message }, { status: 400 })

  // Marcar como leído según quién lo abre (la propia parcela siempre marca su lado,
  // independiente del rol, para que el comité viendo "su parcela" también limpie el aviso)
  if (esMiParcela && !mensaje.leido_parcelero) {
    await supabase.from('mensajes').update({ leido_parcelero: true }).eq('id', id)
  }
  if (sesion.rol === 'comite' && !mensaje.leido_comite) {
    await supabase.from('mensajes').update({ leido_comite: true }).eq('id', id)
  }

  return NextResponse.json({ ...mensaje, respuestas: respuestas || [] })
}

// PATCH: cerrar mensaje (solo comité)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  if (body.estado !== 'cerrado') return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: mensaje } = await supabase.from('mensajes').select('asunto, tipo').eq('id', id).single()

  const { error } = await supabase.from('mensajes').update({ estado: 'cerrado', updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'cerrar_mensaje', 'mensaje', id, { asunto: mensaje?.asunto, tipo: mensaje?.tipo })

  return NextResponse.json({ mensaje: 'Mensaje cerrado' })
}
