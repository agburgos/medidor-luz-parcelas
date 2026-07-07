import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

// Cita de una sola vez a todas las parcelas activas. Quedan marcadas
// como "no asistió" hasta que el comité marque su presencia real.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()

  const [{ data: parcelas }, { data: yaCitados }] = await Promise.all([
    supabase.from('parcelas').select('id, numero, nombre_dueno').eq('activa', true),
    supabase.from('asamblea_asistentes').select('parcela_id').eq('asamblea_id', id),
  ])

  const citadosSet = new Set((yaCitados ?? []).map((a: { parcela_id: string | null }) => a.parcela_id).filter(Boolean))
  const nuevos = (parcelas ?? [])
    .filter((p: { id: string }) => !citadosSet.has(p.id))
    .map((p: { id: string; numero: number; nombre_dueno: string }) => ({
      asamblea_id: id,
      parcela_id: p.id,
      nombre: `#${p.numero} ${p.nombre_dueno}`,
      presente: false,
    }))

  if (nuevos.length > 0) {
    const { error } = await supabase.from('asamblea_asistentes').insert(nuevos)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await registrar(sesion, 'citar_todos_asamblea', 'asamblea', id, { citados: nuevos.length })
  return NextResponse.json({ citados: nuevos.length })
}
