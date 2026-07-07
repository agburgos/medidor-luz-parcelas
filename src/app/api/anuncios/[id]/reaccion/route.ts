import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await getSesion()
  if (!sesion || !sesion.parcelaId) return NextResponse.json({ error: 'Sin parcela vinculada' }, { status: 403 })

  const { tipo } = await req.json()
  if (!['like', 'dislike'].includes(tipo)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: existente } = await supabase
    .from('anuncio_reacciones')
    .select('id, tipo')
    .eq('anuncio_id', id)
    .eq('parcela_id', sesion.parcelaId)
    .maybeSingle()

  if (existente?.tipo === tipo) {
    await supabase.from('anuncio_reacciones').delete().eq('id', existente.id)
  } else {
    await supabase.from('anuncio_reacciones').upsert(
      { anuncio_id: id, parcela_id: sesion.parcelaId, tipo },
      { onConflict: 'anuncio_id,parcela_id' }
    )
  }

  const { data: todas } = await supabase.from('anuncio_reacciones').select('tipo').eq('anuncio_id', id)
  const likes = (todas ?? []).filter((r: { tipo: string }) => r.tipo === 'like').length
  const dislikes = (todas ?? []).filter((r: { tipo: string }) => r.tipo === 'dislike').length
  const miReaccion = existente?.tipo === tipo ? null : tipo

  return NextResponse.json({ likes, dislikes, mi_reaccion: miReaccion })
}
