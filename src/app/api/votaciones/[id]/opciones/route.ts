import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

// GET: obtener opciones de una votación
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: votacion_id } = await params
  const supabase = createServiceClient()

  // Verificar que la votación existe
  const { data: votacion, error: errVot } = await supabase
    .from('votaciones')
    .select('id, estado')
    .eq('id', votacion_id)
    .single()

  if (errVot || !votacion) {
    return NextResponse.json({ error: 'Votación no encontrada' }, { status: 404 })
  }

  // Obtener opciones ordenadas
  const { data: opciones, error: errOpc } = await supabase
    .from('opciones_votacion')
    .select('id, texto, foto_url, orden')
    .eq('votacion_id', votacion_id)
    .order('orden', { ascending: true })

  if (errOpc) {
    return NextResponse.json({ error: errOpc.message }, { status: 400 })
  }

  return NextResponse.json(opciones || [])
}
