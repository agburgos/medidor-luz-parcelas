import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

// GET: votaciones abiertas donde el parcelero aún no ha votado
export async function GET() {
  const sesion = await getSesion()
  if (!sesion || !sesion.parcelaId) return NextResponse.json([])

  const supabase = createServiceClient()
  const ahora = new Date().toISOString()

  const { data: votacionesAbiertas } = await supabase
    .from('votaciones')
    .select('id, titulo, fecha_cierre')
    .eq('estado', 'abierta')
    .gte('fecha_cierre', ahora)
    .order('fecha_cierre', { ascending: true })

  if (!votacionesAbiertas || votacionesAbiertas.length === 0) return NextResponse.json([])

  const { data: misVotos } = await supabase
    .from('votos')
    .select('votacion_id')
    .eq('parcela_id', sesion.parcelaId)

  const idsVotados = new Set((misVotos ?? []).map((v: { votacion_id: string }) => v.votacion_id))
  const pendientes = votacionesAbiertas.filter((v: { id: string }) => !idsVotados.has(v.id))

  return NextResponse.json(pendientes)
}
