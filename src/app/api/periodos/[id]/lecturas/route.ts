import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: periodo_id } = await params
  const supabase = createServiceClient()
  const { lecturas } = await req.json()

  if (!Array.isArray(lecturas) || lecturas.length === 0) {
    return NextResponse.json({ error: 'Sin lecturas' }, { status: 400 })
  }

  // Upsert lecturas (puede haber lecturas ya guardadas de antes)
  const rows = lecturas.map((l: { parcela_id: string; lectura_actual: number; lectura_anterior: number; estado?: string }) => ({
    periodo_id,
    parcela_id: l.parcela_id,
    lectura_actual: l.lectura_actual ?? 0,
    lectura_anterior: l.lectura_anterior ?? 0,
    estado: l.estado || 'normal',
    confirmado: true,
  }))

  const { error } = await supabase
    .from('lecturas')
    .upsert(rows, { onConflict: 'periodo_id,parcela_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ guardadas: rows.length })
}
