import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

// Cierra una votación antes de su fecha programada (comité)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id: votacion_id } = await params
  const supabase = createServiceClient()

  const { data: votacion } = await supabase
    .from('votaciones')
    .select('id, estado')
    .eq('id', votacion_id)
    .single()

  if (!votacion) return NextResponse.json({ error: 'Votación no encontrada' }, { status: 404 })
  if (votacion.estado === 'cerrada') return NextResponse.json({ error: 'La votación ya está cerrada' }, { status: 400 })

  const { data, error } = await supabase
    .from('votaciones')
    .update({ estado: 'cerrada', fecha_cierre: new Date().toISOString() })
    .eq('id', votacion_id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'cerrar_votacion_anticipada', 'votacion', votacion_id)
  return NextResponse.json(data)
}
