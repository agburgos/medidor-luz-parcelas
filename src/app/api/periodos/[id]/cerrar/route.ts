import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

// Cierra un período de facturación. Requiere que el prorrateo ya haya sido
// calculado (no tiene sentido cerrar un período que aún no se facturó).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: periodo } = await supabase
    .from('periodos_facturacion')
    .select('id, estado, prorrateo_calculado')
    .eq('id', id)
    .single()

  if (!periodo) return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 })
  if (periodo.estado === 'cerrado') return NextResponse.json({ error: 'El período ya está cerrado' }, { status: 400 })
  if (!periodo.prorrateo_calculado) {
    return NextResponse.json({ error: 'Debes calcular el prorrateo antes de cerrar el período' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('periodos_facturacion')
    .update({ estado: 'cerrado' })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'cerrar_periodo', 'periodo_facturacion', id)
  return NextResponse.json(data)
}
