import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await req.json()

  const update: Record<string, unknown> = {}
  if (body.estado) update.estado = body.estado
  if (body.monto_pagado !== undefined) update.monto_pagado = Number(body.monto_pagado)
  if (body.observaciones !== undefined) update.observaciones = body.observaciones
  if (body.fecha_pago) update.fecha_pago = body.fecha_pago

  const { data, error } = await supabase
    .from('cuentas_parcela')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
