import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion, esSuperadmin } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: periodo_id } = await params
  const supabase = createServiceClient()
  const { lecturas } = await req.json()

  if (!Array.isArray(lecturas) || lecturas.length === 0) {
    return NextResponse.json({ error: 'Sin lecturas' }, { status: 400 })
  }

  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { data: periodo } = await supabase
    .from('periodos_facturacion')
    .select('prorrateo_calculado')
    .eq('id', periodo_id)
    .single()

  if (periodo?.prorrateo_calculado && !esSuperadmin(sesion)) {
    return NextResponse.json({
      error: 'Las lecturas de este período están cerradas porque ya se calculó el prorrateo. Solo un superadministrador puede reabrirlas.',
    }, { status: 403 })
  }

  // Upsert lecturas (puede haber lecturas ya guardadas de antes). La foto solo se
  // escribe cuando viene una nueva: así guardar números no borra fotos existentes.
  type LecturaIn = { parcela_id: string; lectura_actual: number; lectura_anterior: number; estado?: string; foto_url?: string | null }
  const armar = (l: LecturaIn) => ({
    periodo_id,
    parcela_id: l.parcela_id,
    lectura_actual: l.lectura_actual ?? 0,
    lectura_anterior: l.lectura_anterior ?? 0,
    estado: l.estado || 'normal',
    confirmado: true,
  })
  const conFoto = (lecturas as LecturaIn[]).filter(l => l.foto_url)
  const sinFoto = (lecturas as LecturaIn[]).filter(l => !l.foto_url)
  const rows = [...sinFoto.map(armar), ...conFoto.map(l => ({ ...armar(l), foto_url: l.foto_url }))]

  for (const grupo of [sinFoto.map(armar), conFoto.map(l => ({ ...armar(l), foto_url: l.foto_url }))]) {
    if (grupo.length === 0) continue
    const { error } = await supabase.from('lecturas').upsert(grupo, { onConflict: 'periodo_id,parcela_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await registrar(sesion, 'guardar_lecturas_masivo', 'periodo_facturacion', periodo_id, { cantidad: rows.length, con_foto: conFoto.length })

  return NextResponse.json({ guardadas: rows.length })
}
