import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

// POST: el comité fusiona una opción (origen) dentro de otra (destino): los
// votos del origen pasan al destino y el origen desaparece. Sirve para juntar
// propuestas parecidas ("piscina" y "una piscina") sin perder ningún voto.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id: votacion_id } = await params
  const { origen_id, destino_id } = await req.json()
  if (!origen_id || !destino_id || origen_id === destino_id) {
    return NextResponse.json({ error: 'Elige dos opciones distintas' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data: opciones } = await supabase
    .from('opciones_votacion')
    .select('id, texto')
    .eq('votacion_id', votacion_id)
    .in('id', [origen_id, destino_id])
  const origen = opciones?.find((o: { id: string }) => o.id === origen_id)
  const destino = opciones?.find((o: { id: string }) => o.id === destino_id)
  if (!origen || !destino) return NextResponse.json({ error: 'Opción no encontrada' }, { status: 404 })

  const { data: votos } = await supabase.from('votos').select('id, opcion_id, opcion_ids').eq('votacion_id', votacion_id)
  let movidos = 0
  for (const v of (votos ?? []) as { id: string; opcion_id: string | null; opcion_ids: string[] | null }[]) {
    if (v.opcion_id === origen_id) {
      await supabase.from('votos').update({ opcion_id: destino_id }).eq('id', v.id)
      movidos++
    } else if (v.opcion_ids?.includes(origen_id)) {
      // Si ya había votado por el destino, no se cuenta dos veces
      const nuevos = [...new Set(v.opcion_ids.map(id => (id === origen_id ? destino_id : id)))]
      await supabase.from('votos').update({ opcion_ids: nuevos }).eq('id', v.id)
      movidos++
    }
  }

  const { error } = await supabase.from('opciones_votacion').delete().eq('id', origen_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'fusionar_opciones_votacion', 'votacion', votacion_id, {
    origen: origen.texto, destino: destino.texto, votos_movidos: movidos,
  })
  return NextResponse.json({ ok: true, votos_movidos: movidos })
}
