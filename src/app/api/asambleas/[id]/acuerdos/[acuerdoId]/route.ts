import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ acuerdoId: string }> }) {
  const { acuerdoId } = await params
  const sesion = await getSesion()
  if (!sesion || sesion.rol !== 'comite') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const supabase = createServiceClient()
  const body = await req.json()
  const { data, error } = await supabase
    .from('asamblea_acuerdos')
    .update({ estado: body.estado })
    .eq('id', acuerdoId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await registrar(sesion, 'cambiar_estado_acuerdo', 'asamblea_acuerdo', acuerdoId, { estado: body.estado })

  return NextResponse.json(data)
}
