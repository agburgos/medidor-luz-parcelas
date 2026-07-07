import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

// El parcelero vota like/dislike en una asamblea (una reacción por parcela, cambiable).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await getSesion()
  if (!sesion || !sesion.parcelaId) return NextResponse.json({ error: 'Sin parcela vinculada' }, { status: 403 })

  const { tipo } = await req.json()
  if (!['like', 'dislike'].includes(tipo)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

  const supabase = createServiceClient()

  // Si ya votó lo mismo, quitar el voto (toggle); si votó distinto, cambiarlo.
  const { data: existente } = await supabase
    .from('asamblea_reacciones')
    .select('id, tipo')
    .eq('asamblea_id', id)
    .eq('parcela_id', sesion.parcelaId)
    .maybeSingle()

  if (existente?.tipo === tipo) {
    await supabase.from('asamblea_reacciones').delete().eq('id', existente.id)
  } else {
    await supabase.from('asamblea_reacciones').upsert(
      { asamblea_id: id, parcela_id: sesion.parcelaId, tipo },
      { onConflict: 'asamblea_id,parcela_id' }
    )
  }

  const { data: todas } = await supabase.from('asamblea_reacciones').select('tipo').eq('asamblea_id', id)
  const likes = (todas ?? []).filter((r: { tipo: string }) => r.tipo === 'like').length
  const dislikes = (todas ?? []).filter((r: { tipo: string }) => r.tipo === 'dislike').length
  const miReaccion = existente?.tipo === tipo ? null : tipo

  return NextResponse.json({ likes, dislikes, mi_reaccion: miReaccion })
}
