import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth'
import { registrar } from '@/lib/bitacora'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await req.json()

  const update: Record<string, unknown> = {}
  if (body.estado) update.estado = body.estado
  if (body.observaciones !== undefined) update.observaciones = body.observaciones

  const { data, error } = await supabase.from('cuentas_gc').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const sesion = await getSesion()
  await registrar(sesion, 'editar_cuenta_gc', 'cuenta_gc', id, update)

  return NextResponse.json(data)
}
