import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await req.json()

  const { data: mora } = await supabase.from('moras_anteriores').select('*').eq('id', id).single()
  if (!mora) return NextResponse.json({ error: 'Mora no encontrada' }, { status: 404 })

  const update: Record<string, unknown> = {}
  if (body.abono !== undefined) {
    const nuevoPagado = Number(mora.monto_pagado) + Number(body.abono)
    update.monto_pagado = nuevoPagado
    update.estado = nuevoPagado >= Number(mora.monto) ? 'pagado' : 'pago_parcial'
  }
  if (body.descripcion !== undefined) update.descripcion = body.descripcion
  if (body.monto !== undefined) update.monto = Number(body.monto)

  const { data, error } = await supabase
    .from('moras_anteriores')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const { error } = await supabase.from('moras_anteriores').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ eliminada: true })
}
