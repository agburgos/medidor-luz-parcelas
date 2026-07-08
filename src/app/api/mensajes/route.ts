import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

// GET: comité ve todos los mensajes (con datos de la parcela); parcelero ve solo los suyos
export async function GET(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = createServiceClient()
  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get('tipo')
  const estado = searchParams.get('estado')
  const propio = searchParams.get('propio') === '1'

  // "propio=1" fuerza ver solo los mensajes de mi parcela, aunque mi rol sea comité
  // (usado por /parcelero/mensajes cuando el comité está viendo su propia parcela).
  if (sesion.rol === 'comite' && !propio) {
    let query = supabase
      .from('mensajes')
      .select('id, tipo, asunto, mensaje, adjunto_url, estado, leido_comite, created_at, updated_at, parcela:parcelas(id, numero, nombre_dueno)')
      .order('created_at', { ascending: false })
    if (tipo) query = query.eq('tipo', tipo)
    if (estado) query = query.eq('estado', estado)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data || [])
  }

  if (!sesion.parcelaId) return NextResponse.json([])

  const { data, error } = await supabase
    .from('mensajes')
    .select('id, tipo, asunto, mensaje, adjunto_url, estado, leido_parcelero, created_at, updated_at')
    .eq('parcela_id', sesion.parcelaId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data || [])
}

// POST: crear mensaje (cualquier sesión con parcela asociada)
export async function POST(req: NextRequest) {
  const sesion = await getSesion()
  if (!sesion || !sesion.parcelaId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await req.json()
  const { tipo, asunto, mensaje, adjunto_url } = body

  if (!tipo || !['reclamo', 'denuncia', 'sugerencia', 'felicitacion'].includes(tipo)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }
  if (!asunto || !mensaje) {
    return NextResponse.json({ error: 'Asunto y mensaje son requeridos' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('mensajes')
    .insert({
      parcela_id: sesion.parcelaId,
      tipo,
      asunto,
      mensaje,
      adjunto_url: adjunto_url || null,
      leido_comite: false,
      leido_parcelero: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
