import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion, esSuperadmin } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

// Reabre un período cerrado (corrección de un cierre hecho por error).
// Solo superadmin, ya que reabrir un período ya facturado es una acción
// delicada (afecta reportes y el período "activo" que ven los parceleros).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await getSesion()
  if (!sesion || !esSuperadmin(sesion)) return NextResponse.json({ error: 'Solo superadmin puede reabrir un período' }, { status: 403 })

  const { id } = await params
  const supabase = createServiceClient()

  const { data: periodo } = await supabase
    .from('periodos_facturacion')
    .select('id, estado')
    .eq('id', id)
    .single()

  if (!periodo) return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 })
  if (periodo.estado === 'abierto') return NextResponse.json({ error: 'El período ya está abierto' }, { status: 400 })

  const { data, error } = await supabase
    .from('periodos_facturacion')
    .update({ estado: 'abierto' })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'reabrir_periodo', 'periodo_facturacion', id)
  return NextResponse.json(data)
}
